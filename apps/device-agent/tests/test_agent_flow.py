"""State-flow tests: real agent + real HTTP against the in-process fake server."""

import json
import logging
import os
import tempfile
import threading
import unittest
from pathlib import Path

from fake_server import FakeServer, make_raster
from kvittel_agent import journal as J
from kvittel_agent.agent import Agent, CredentialStore, event_uid, pair_device
from kvittel_agent.config import AgentConfig, HooksConfig
from kvittel_agent.printers.base import CAPABILITY_KEYS
from kvittel_agent.printers.mock import MockFaults, MockPrinterAdapter
from kvittel_agent.sensors import MockChuteSensor, NullChuteSensor
from kvittel_agent.transport import AuthError, Backoff

logging.disable(logging.CRITICAL)


class FlowBase(unittest.TestCase):
    def setUp(self):
        self.server = FakeServer().start()
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.cfg = AgentConfig(
            server_url=self.server.url, token_file=str(root / "credentials.json"),
            spool_dir=str(root / "spool"), backoff_initial_s=0.01, backoff_max_s=0.05, http_timeout_s=5,
        )
        self.out_dir = root / "printed"
        self.creds = pair_device(self.cfg, self.server.url, "7h2k-9qxd", hw_id="rpi-serial-test")

    def tearDown(self):
        self.server.stop()
        self.tmp.cleanup()

    def make_agent(self, *, faults=None, chute=None, hooks=None) -> Agent:
        if hooks is not None:
            self.cfg.hooks = hooks
        self.printer = MockPrinterAdapter(self.out_dir, faults=faults or MockFaults())
        self.chute = chute if chute is not None else MockChuteSensor(detect=True, delay_s=0.02)
        agent = Agent(self.cfg, printer=self.printer, chute=self.chute,
                      backoff=Backoff(0.01, 0.05))
        agent.boot()
        return agent


class PairingTests(FlowBase):
    def test_pair_persists_credentials(self):
        data = json.loads(Path(self.cfg.token_file).read_text())
        self.assertEqual(data["deviceId"], "dev-1")
        self.assertTrue(data["token"].startswith("kvd_"))
        self.assertEqual(data["serverUrl"], self.server.url)
        if os.name == "posix":
            self.assertEqual(os.stat(self.cfg.token_file).st_mode & 0o777, 0o600)

    def test_pair_refuses_overwrite_and_bad_code(self):
        with self.assertRaises(Exception):
            pair_device(self.cfg, self.server.url, "7H2K-9QXD", hw_id="x")
        with self.assertRaises(ValueError):
            pair_device(self.cfg, self.server.url, "nope", hw_id="x", force=True)


class HappyPathTests(FlowBase):
    def test_lease_print_cut_chute_confirmed(self):
        self.server.add_job("job-1", "cmd_1")
        agent = self.make_agent()
        agent.run_cycle()
        self.assertEqual(self.server.events_for("job-1"),
                         ["print_started", "print_completed", "cut_completed", "chute_detected"])
        self.assertEqual(self.server.jobs["job-1"]["status"], "delivered")
        self.assertEqual(len(self.printer.printed_pages), 1)
        self.assertEqual([op[0] for op in self.printer.operations], ["print", "feed", "cut"])
        self.assertEqual(agent.journal.last_state("cmd_1"), J.DELIVERED)
        self.assertEqual(len(agent.outbox), 0)
        self.assertEqual(len(list(self.out_dir.glob("*.pbm"))), 1)
        # all events for this lease carry the lease id and deterministic uids
        for ev in self.server.accepted_events:
            self.assertEqual(ev["leaseId"], "lease_1")
            self.assertEqual(ev["eventUid"], event_uid("lease_1", ev["type"]))

    def test_heartbeat_telemetry_shape(self):
        agent = self.make_agent()
        agent.run_cycle()
        tel = self.server.heartbeats[-1]["telemetry"]
        for key in ("network", "signalDbm", "latencyMs", "power", "batteryPct", "paperSensor", "cover", "cutter",
                    "chuteSensor", "camera", "tempC", "uptimeS", "queueDepth", "capabilities"):
            self.assertIn(key, tel)
        self.assertEqual(tel["power"], "unsupported")  # no UPS → honest
        self.assertIsNone(tel["batteryPct"])
        self.assertTrue(set(tel["capabilities"].values()) <= {"supported", "unsupported"})
        self.assertEqual(self.server.heartbeats[-1]["bootId"], agent.boot_id)

    def test_no_chute_sensor_is_printer_reported(self):
        self.server.add_job("job-1", "cmd_1")
        agent = self.make_agent(chute=NullChuteSensor())
        agent.run_cycle()
        self.assertEqual(self.server.events_for("job-1"), ["print_started", "print_completed", "cut_completed"])
        self.assertEqual(agent.journal.get("cmd_1").extra.get("confidence"), "printer_reported")
        self.assertEqual(self.server.heartbeats[-1]["telemetry"]["capabilities"]["chuteSensor"], "unsupported")

    def test_multi_page_job(self):
        self.server.add_job("job-1", "cmd_1", raster=make_raster(heights=(32, 40)))
        chute = MockChuteSensor(delay_s=0.02)
        chute.drops_per_arm = 2
        agent = self.make_agent(chute=chute)
        agent.run_cycle()
        self.assertEqual([op[0] for op in self.printer.operations], ["print", "feed", "cut", "print", "feed", "cut"])
        self.assertEqual(self.server.events_for("job-1")[-1], "chute_detected")


class UncertainPathTests(FlowBase):
    def test_lease_print_chute_timeout_goes_uncertain(self):
        self.server.config["chuteTimeoutMs"] = 500  # minimum the agent accepts
        self.server.add_job("job-1", "cmd_1")
        self.server.add_job("job-2", "cmd_2")
        agent = self.make_agent(chute=MockChuteSensor(detect=False))
        agent.run_cycle()
        self.assertEqual(self.server.events_for("job-1"),
                         ["print_started", "print_completed", "cut_completed", "chute_timeout"])
        self.assertEqual(self.server.jobs["job-1"]["status"], "uncertain")
        self.assertEqual(agent.journal.last_state("cmd_1"), J.CHUTE_TIMEOUT)
        self.assertFalse(agent.journal.can_print("cmd_1"))
        # Physical fault → local hold: job-2 is not leased until clear_error.
        self.assertEqual(self.server.jobs["job-2"]["status"], "queued")
        self.assertEqual(agent.hold_reason, "chute_timeout")
        agent.run_cycle()
        self.assertEqual(self.server.jobs["job-2"]["status"], "queued")
        self.server.add_command("clear_error", cid="c-clear")
        self.chute.detect = True
        agent.run_cycle()
        self.assertEqual(self.server.command_results["c-clear"]["status"], "succeeded")
        self.assertEqual(self.server.jobs["job-2"]["status"], "delivered")

    def test_power_loss_mid_print_reports_interrupted_on_boot(self):
        self.server.add_job("job-1", "cmd_1")
        agent = self.make_agent()
        # Simulate: lease + print_started acknowledged + journal "printing", then power loss.
        agent.transport.request("POST", "/heartbeat", {"seq": 1, "telemetry": {}})
        lease = agent.transport.request("POST", "/jobs/lease", {}).body["job"]
        agent.journal.record("cmd_1", J.LEASED, job_id="job-1", lease_id=lease["leaseId"])
        agent.transport.request("POST", "/jobs/job-1/events", {
            "leaseId": lease["leaseId"], "eventUid": event_uid(lease["leaseId"], "print_started"),
            "type": "print_started", "at": "2026-11-13T00:00:00Z", "data": {}})
        agent.journal.record("cmd_1", J.PRINTING)

        rebooted = self.make_agent()  # new process, same spool
        self.assertEqual(self.server.events_for("job-1"), ["print_started", "interrupted"])
        self.assertEqual(self.server.jobs["job-1"]["status"], "uncertain")
        self.assertEqual(rebooted.journal.last_state("cmd_1"), J.INTERRUPTED)
        self.assertEqual(len(self.printer.printed_pages), 0)
        self.assertIn("boot", [e["type"] for e in self.server.device_events])
        # A second reboot must not report it again.
        self.make_agent()
        self.assertEqual(self.server.events_for("job-1").count("interrupted"), 1)

    def test_same_command_id_is_never_printed_twice(self):
        self.server.add_job("job-1", "cmd_1")
        agent = self.make_agent()
        agent.run_cycle()
        self.assertEqual(len(self.printer.printed_pages), 1)
        self.server.add_job("job-1b", "cmd_1")  # server bug / replay: same commandId
        agent.run_cycle()
        self.assertEqual(len(self.printer.printed_pages), 1)
        self.assertEqual(self.server.events_for("job-1b"), ["interrupted"])
        self.assertEqual(self.server.accepted_events[-1]["data"]["reason"], "already_journaled")

    def test_cutter_jam_after_print(self):
        self.server.add_job("job-1", "cmd_1")
        agent = self.make_agent(faults=MockFaults(cutter_jam_on_cut=True))
        agent.run_cycle()
        self.assertEqual(self.server.events_for("job-1"), ["print_started", "print_completed", "failed"])
        failed = self.server.accepted_events[-1]["data"]
        self.assertEqual((failed["error"], failed["phase"]), ("cutter_jam", "after_print"))
        self.assertEqual(self.server.jobs["job-1"]["status"], "uncertain")
        self.assertIn("cutter_fault", [e["type"] for e in self.server.device_events])
        self.assertEqual(agent.hold_reason, "cutter_jam")


class RetryTests(FlowBase):
    def test_event_post_fails_then_retried_with_same_event_uid(self):
        self.server.fail_event_types = {"print_completed": 2}
        self.server.add_job("job-1", "cmd_1")
        agent = self.make_agent()
        agent.run_cycle()
        # print_completed failed → it and everything after it wait in the outbox, in order.
        self.assertEqual(self.server.events_for("job-1"), ["print_started"])
        self.assertEqual([i.body["type"] for i in agent.outbox.items()],
                         ["print_completed", "cut_completed", "chute_detected"])
        self.assertEqual(len(self.printer.printed_pages), 1)

        # Agent restarts before the retry: outbox survives on disk.
        rebooted = self.make_agent()
        rebooted.flush_outbox()
        self.assertEqual(self.server.events_for("job-1"),
                         ["print_started", "print_completed", "cut_completed", "chute_detected"])
        attempts = [(uid, ok) for uid, t, ok in self.server.event_attempts if t == "print_completed"]
        self.assertEqual([ok for _, ok in attempts], [False, False, True])
        self.assertEqual(len({uid for uid, _ in attempts}), 1, "retries must reuse the same eventUid")
        self.assertEqual(len(rebooted.outbox), 0)
        self.assertEqual(len(self.printer.printed_pages), 0)  # the rebooted agent printed nothing

    def test_duplicate_delivery_is_idempotent(self):
        self.server.add_job("job-1", "cmd_1")
        agent = self.make_agent()
        agent.run_cycle()
        ev = next(e for e in self.server.accepted_events if e["type"] == "cut_completed")
        body = {k: v for k, v in ev.items() if not k.startswith("_")}
        agent.transport.request("POST", "/jobs/job-1/events", body)  # e.g. ack lost, resent
        self.assertEqual(self.server.events_for("job-1").count("cut_completed"), 1)

    def test_heartbeat_retry_with_backoff(self):
        agent = self.make_agent()
        self.server.fail_heartbeats = 2
        resp = agent.transport.request_with_retry("POST", "/heartbeat", {"seq": 1}, max_attempts=5)
        self.assertEqual(resp.status, 200)

    def test_print_started_stop_means_no_print(self):
        self.server.print_started_next = "stop"
        self.server.add_job("job-1", "cmd_1")
        agent = self.make_agent()
        agent.run_cycle()
        self.assertEqual(self.printer.printed_pages, [])
        self.assertEqual(agent.journal.last_state("cmd_1"), J.RELEASED)

    def test_print_started_unreachable_means_no_print(self):
        self.server.fail_event_types = {"print_started": 10_000}
        self.server.add_job("job-1", "cmd_1", lease_seconds=6)  # deadline = lease - 5 s margin
        agent = self.make_agent()
        agent.run_cycle()
        self.assertEqual(self.printer.printed_pages, [])
        self.assertEqual(agent.journal.last_state("cmd_1"), J.RELEASED)
        self.assertTrue(agent.journal.can_print("cmd_1"))

    def test_paper_end_before_print_requeues_without_printing(self):
        self.server.add_job("job-1", "cmd_1")
        agent = self.make_agent(faults=MockFaults(paper_end=True))
        agent.run_cycle()
        self.assertEqual(self.server.events_for("job-1"), ["failed"])
        data = self.server.accepted_events[-1]["data"]
        self.assertEqual((data["error"], data["phase"]), ("paper_end", "before_print"))
        self.assertEqual(self.server.jobs["job-1"]["status"], "queued")
        self.assertEqual(self.printer.printed_pages, [])
        self.assertIn("paper_end", [e["type"] for e in self.server.device_events])
        # paper loaded → the re-queued job (same commandId) may print now
        self.printer.faults.paper_end = False
        agent.run_cycle()
        self.assertEqual(len(self.printer.printed_pages), 1)
        self.assertIn("paper_loaded", [e["type"] for e in self.server.device_events])

    def test_invalid_raster(self):
        raster = make_raster()
        raster["digest"] = "384x64-00000000"
        self.server.add_job("job-1", "cmd_1", raster=raster)
        agent = self.make_agent()
        agent.run_cycle()
        self.assertEqual(self.server.accepted_events[-1]["data"]["error"], "raster_invalid")
        self.assertEqual(self.printer.printed_pages, [])


class CommandFlowTests(FlowBase):
    def test_signed_commands_and_rejections(self):
        agent = self.make_agent()
        ok = self.server.add_command("test_print", {})
        bad = self.server.add_command("pause", {}, bad_signature=True)
        expired = self.server.add_command("pause", {}, expires_in_s=-5)
        cfg = self.server.add_command("config_update", {"heartbeatSec": 20})
        reboot = self.server.add_command("reboot_agent", {})
        ota = self.server.add_command("ota_update", {"url": "https://x/agent.tgz"})
        agent.run_cycle()
        r = self.server.command_results
        self.assertEqual(r[ok]["status"], "succeeded")
        self.assertEqual(len(self.printer.printed_pages), 1)
        self.assertEqual(r[bad], {"status": "failed", "result": {"message": "bad_signature"}})
        self.assertEqual(r[expired]["result"]["message"], "expired")
        self.assertFalse(agent.local_paused)  # neither pause took effect
        self.assertEqual(r[cfg]["status"], "succeeded")
        self.assertEqual(r[reboot]["result"]["message"], "disabled_by_config")
        self.assertEqual(r[ota]["result"]["message"], "ota_not_supported")
        self.assertIsNone(agent.exit_code)

    def test_command_executed_at_most_once(self):
        agent = self.make_agent()
        cid = self.server.add_command("test_print", {})
        replay = dict(self.server.pending_commands[0])
        agent.run_cycle()
        self.server.pending_commands.append(replay)
        agent.run_cycle()
        self.assertEqual(len(self.printer.printed_pages), 1)
        self.assertEqual(self.server.command_results[cid]["status"], "succeeded")

    def test_pause_blocks_leasing_and_restart_hook_exits(self):
        agent = self.make_agent(hooks=HooksConfig(restart_service="exit"))
        self.server.add_command("pause", {})
        self.server.add_job("job-1", "cmd_1")
        agent.run_cycle()
        self.assertTrue(agent.local_paused)
        self.assertEqual(self.server.jobs["job-1"]["status"], "queued")
        self.server.add_command("restart_service", {}, cid="c-restart")
        stop = threading.Event()
        self.assertEqual(agent.run(stop), 75)
        self.assertEqual(self.server.command_results["c-restart"]["status"], "succeeded")


class TokenTests(FlowBase):
    def test_rotation_after_30_days(self):
        store = CredentialStore(Path(self.cfg.token_file))
        old = store.load()
        old.issued_at = "2020-01-01T00:00:00.000Z"
        store.save(old)
        agent = self.make_agent()
        agent.run_cycle()
        self.assertEqual(self.server.rotations, 1)
        new = store.load()
        self.assertNotEqual(new.token, old.token)
        self.assertEqual(agent.creds.token, new.token)
        agent.run_cycle()  # works with the new token, no second rotation
        self.assertEqual(self.server.rotations, 1)

    def test_revoked_token_raises_auth_error(self):
        agent = self.make_agent()
        self.server.tokens.clear()
        with self.assertRaises(AuthError):
            agent.run_cycle()

    def test_diagnostics_has_no_secrets(self):
        agent = self.make_agent()
        diag = json.dumps(agent.diagnostics())
        self.assertNotIn(agent.creds.token, diag)
        self.assertNotIn(agent.creds.command_key, diag)
        self.assertEqual(set(agent.diagnostics()["printer"]["capabilities"]), set(CAPABILITY_KEYS))


if __name__ == "__main__":
    unittest.main()
