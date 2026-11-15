"""Main agent: pairing, heartbeat, signed commands, lease → print → chute → events.

Physical-print safety (see DEVICE_PROTOCOL.md):

1. ``print_started`` must be acknowledged with ``next: "continue"`` before the
   printer is touched (``stop`` or no ack → do not print, lease is released).
2. ``printing`` is fsync'd to the journal before the first byte is sent.
3. Everything after that is reported through the persistent outbox, with
   deterministic ``eventUid = uuid5(leaseId:type)`` so retries — even across a
   reboot — are idempotent.
4. A ``commandId`` already beyond the pre-print states is never printed again;
   if the server leases it anyway we report ``interrupted`` (→ ``uncertain``).
"""

from __future__ import annotations

import logging
import threading
import time
import uuid
from dataclasses import dataclass, field, replace
from datetime import timedelta
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from urllib.parse import quote

from . import __version__
from . import journal as J
from .clock import Clock, parse_iso
from .commands import (
    Command, CommandOutcome, CommandRejected, HookRunner, SAFE_ID_RE, SeenCommands,
    decode_command_key, keep_until, verify_command,
)
from .config import AgentConfig, ConfigError
from .fsutil import atomic_write_json, read_json
from .journal import Journal
from .outbox import (
    KIND_COMMAND_RESULT, KIND_DEVICE_EVENT, KIND_JOB_EVENT, Outbox, OutboxItem, SendResult,
)
from .printers.base import PrinterAdapter, PrinterError, PrinterStatus
from .raster import JobRaster, RasterInvalid, parse_job_raster, test_pattern
from .sensors import ChuteSensor, NullChuteSensor, NullPowerMonitor, PowerMonitor
from .telemetry import TelemetryCollector, hardware_id
from .transport import AuthError, Backoff, HttpError, Transport, TransportError

log = logging.getLogger("kvittel.agent")

EVENT_NS = uuid.UUID("6f1c2a52-6a8e-4d0b-9a57-6b7c1e0f4d21")
MIN_LEASE_REMAINING_S = 5.0
MAX_JOBS_PER_CYCLE = 5
PAIRING_CODE_RE = r"^[A-Z0-9]{4}-[A-Z0-9]{4}$"

SEVERITY = {
    "boot": "info", "cover_open": "critical", "cover_closed": "info", "paper_end": "critical",
    "paper_near_end": "warning", "paper_loaded": "info", "power_lost": "critical",
    "power_restored": "info", "cutter_fault": "critical", "chute_sensor_fault": "critical",
    "spool_overflow": "warning",
}


class NotPaired(Exception):
    pass


# --- credentials ----------------------------------------------------------------------------

@dataclass
class Credentials:
    device_id: str
    token: str = field(repr=False)
    command_key: str = field(repr=False)
    issued_at: str
    server_url: str

    def to_json(self) -> Dict[str, Any]:
        return {"v": 1, "deviceId": self.device_id, "token": self.token, "commandKey": self.command_key,
                "issuedAt": self.issued_at, "serverUrl": self.server_url}

    @classmethod
    def from_json(cls, d: Dict[str, Any]) -> "Credentials":
        try:
            return cls(d["deviceId"], d["token"], d["commandKey"], d["issuedAt"], d["serverUrl"])
        except (KeyError, TypeError):
            raise NotPaired("credentials file is malformed") from None


class CredentialStore:
    """Credentials JSON written atomically with mode 0600."""

    def __init__(self, path: Path) -> None:
        self.path = Path(path)

    def exists(self) -> bool:
        return self.path.exists()

    def load(self) -> Credentials:
        data = read_json(self.path, default=None)
        if not isinstance(data, dict):
            raise NotPaired(f"not paired (no credentials at {self.path})")
        return Credentials.from_json(data)

    def save(self, creds: Credentials) -> None:
        atomic_write_json(self.path, creds.to_json(), mode=0o600)


# --- runtime config pushed by the server ------------------------------------------------

@dataclass
class RuntimeConfig:
    heartbeat_sec: int = 15
    lease_sec: int = 90
    chute_timeout_ms: int = 8000
    version: Optional[int] = None

    _LIMITS = {"heartbeatSec": (5, 300), "leaseSec": (30, 900), "chuteTimeoutMs": (500, 60000)}

    def update(self, d: Dict[str, Any]) -> List[str]:
        """Apply known keys (clamped). Returns unknown keys."""
        unknown = []
        for key, value in d.items():
            if key == "version":
                if isinstance(value, int):
                    self.version = value
                continue
            if key not in self._LIMITS:
                unknown.append(key)
                continue
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                unknown.append(key)
                continue
            lo, hi = self._LIMITS[key]
            v = int(min(hi, max(lo, value)))
            if key == "heartbeatSec":
                self.heartbeat_sec = v
            elif key == "leaseSec":
                self.lease_sec = v
            else:
                self.chute_timeout_ms = v
        return unknown

    def as_dict(self) -> Dict[str, Any]:
        return {"version": self.version, "heartbeatSec": self.heartbeat_sec,
                "leaseSec": self.lease_sec, "chuteTimeoutMs": self.chute_timeout_ms}


@dataclass
class HeartbeatResult:
    job_available: bool
    paused: bool
    commands: List[Any]


@dataclass
class LeasedJob:
    job_id: str
    command_id: str
    lease_id: str
    lease_expires_at: Any  # datetime
    attempt_no: Optional[int]
    is_test: bool
    raster: Any


def _parse_lease(job: Any) -> LeasedJob:
    if not isinstance(job, dict):
        raise ValueError("job must be an object")
    ids = [job.get(k) for k in ("jobId", "commandId", "leaseId")]
    if not all(isinstance(v, str) and SAFE_ID_RE.match(v) for v in ids):
        raise ValueError("job ids missing or malformed")
    exp = parse_iso(job.get("leaseExpiresAt", ""))
    attempt = job.get("attemptNo") if isinstance(job.get("attemptNo"), int) else None
    return LeasedJob(ids[0], ids[1], ids[2], exp, attempt, bool(job.get("isTest", False)), job.get("raster"))


def event_uid(lease_id: str, event_type: str) -> str:
    return str(uuid.uuid5(EVENT_NS, f"{lease_id}:{event_type}"))


# --- agent ----------------------------------------------------------------------------------

class Agent:
    def __init__(
        self,
        cfg: AgentConfig,
        *,
        printer: PrinterAdapter,
        chute: Optional[ChuteSensor] = None,
        power: Optional[PowerMonitor] = None,
        telemetry: Optional[TelemetryCollector] = None,
        clock: Optional[Clock] = None,
        transport: Optional[Transport] = None,
        hook_runner: Optional[HookRunner] = None,
        backoff: Optional[Backoff] = None,
    ) -> None:
        self.cfg = cfg
        self.spool = Path(cfg.spool_dir)
        self.spool.mkdir(parents=True, exist_ok=True)
        self.clock = clock or Clock()
        self.printer = printer
        self.chute = chute or NullChuteSensor()
        self.power = power or NullPowerMonitor()
        self.telemetry = telemetry or TelemetryCollector()
        self.backoff = backoff or Backoff(cfg.backoff_initial_s, cfg.backoff_max_s)
        self.creds_store = CredentialStore(Path(cfg.token_file))
        self.creds: Optional[Credentials] = None
        self._creds_dirty = False
        self._transport = transport
        self.journal = Journal(self.spool / "journal.jsonl", self.clock.iso_now)
        self.outbox = Outbox(self.spool / "outbox.json", cfg.outbox_max)
        self.seen = SeenCommands(self.spool / "commands_seen.json")
        self.hooks = hook_runner or HookRunner(cfg.hooks)
        self.runtime = RuntimeConfig(cfg.heartbeat_sec, cfg.lease_sec, cfg.chute_timeout_ms)
        self.boot_id = str(uuid.uuid4())
        self.seq = 0
        self.server_paused = False
        self._state_path = self.spool / "state.json"
        state = read_json(self._state_path, default={}) or {}
        self.local_paused = bool(state.get("localPaused", False))
        # Latched local hold after a physical fault (chute timeout, cutter jam): no new
        # leases until an operator/admin sends clear_error. Survives restarts.
        self.hold_reason: Optional[str] = state.get("holdReason") if isinstance(state.get("holdReason"), str) else None
        self.exit_code: Optional[int] = None
        self.current_job: Optional[Dict[str, Any]] = None
        self._last_readings: Dict[str, str] = {}
        self._booted = False

    # -- plumbing ---------------------------------------------------------------------------
    @property
    def paused(self) -> bool:
        return self.server_paused or self.local_paused or self.hold_reason is not None

    def _token(self) -> Optional[str]:
        return self.creds.token if self.creds else None

    @property
    def transport(self) -> Transport:
        if self._transport is None:
            if self.creds is None:
                raise NotPaired("not paired")
            if self.cfg.server_url and self.cfg.server_url.rstrip("/") != self.creds.server_url.rstrip("/"):
                # The token belongs to the server that issued it; never send it elsewhere.
                log.warning("config server_url differs from paired server; using paired server")
            self._transport = Transport(
                self.creds.server_url, self.clock, self._token, timeout_s=self.cfg.http_timeout_s,
                allow_insecure_http=self.cfg.allow_insecure_http, ca_file=self.cfg.ca_file, backoff=self.backoff,
            )
        return self._transport

    def _save_state(self) -> None:
        atomic_write_json(self._state_path, {"v": 1, "localPaused": self.local_paused, "holdReason": self.hold_reason})

    def _latch_hold(self, reason: str) -> None:
        self.hold_reason = reason
        self._save_state()
        log.warning("leasing on hold (reason=%s) until clear_error", reason)

    # -- outbox helpers -----------------------------------------------------------------------
    def _job_event_body(self, job_id: str, lease_id: str, etype: str, data: Dict[str, Any]) -> OutboxItem:
        uid = event_uid(lease_id, etype)
        return OutboxItem(
            uid=uid, kind=KIND_JOB_EVENT, path=f"/jobs/{quote(job_id, safe='')}/events",
            body={"leaseId": lease_id, "eventUid": uid, "type": etype, "at": self.clock.iso_now(), "data": data},
            enqueued_at=self.clock.iso_now(), meta={"jobId": job_id, "type": etype},
        )

    def enqueue_job_event(self, job_id: str, lease_id: str, etype: str, data: Optional[Dict[str, Any]] = None) -> None:
        item = self._job_event_body(job_id, lease_id, etype, data or {})
        self.outbox.enqueue(item)
        log.info("job event queued job=%s type=%s uid=%s", job_id, etype, item.uid)

    def enqueue_device_event(self, etype: str, data: Optional[Dict[str, Any]] = None) -> None:
        uid = str(uuid.uuid4())
        ev = {"eventUid": uid, "type": etype, "severity": SEVERITY.get(etype, "info"),
              "at": self.clock.iso_now(), "data": data or {}}
        self.outbox.enqueue(OutboxItem(uid=uid, kind=KIND_DEVICE_EVENT, path="/events", body={"events": [ev]},
                                       enqueued_at=ev["at"], meta={"type": etype}))
        log.info("device event queued type=%s uid=%s", etype, uid)

    def enqueue_command_result(self, command_id: str, outcome: CommandOutcome) -> None:
        self.outbox.enqueue(OutboxItem(
            uid=f"result:{command_id}", kind=KIND_COMMAND_RESULT,
            path=f"/commands/{quote(command_id, safe='')}/result", body=outcome.result_body(),
            enqueued_at=self.clock.iso_now(), meta={"commandId": command_id, "status": outcome.status},
        ))

    def _send_item(self, item: OutboxItem) -> SendResult:
        try:
            resp = self.transport.request("POST", item.path, item.body)
        except AuthError:
            return SendResult.RETRY
        except HttpError as e:
            if e.retryable:
                return SendResult.RETRY
            if e.status in (400, 404, 409, 410, 422):
                return SendResult.DROP
            return SendResult.RETRY
        except TransportError:
            return SendResult.RETRY
        if item.kind == KIND_JOB_EVENT and isinstance(resp.body, dict):
            log.info("job event delivered job=%s type=%s status=%s next=%s", item.meta.get("jobId"),
                     item.meta.get("type"), resp.body.get("status"), resp.body.get("next"))
        return SendResult.OK

    def flush_outbox(self, max_items: Optional[int] = None) -> int:
        if not len(self.outbox):
            return 0
        return self.outbox.flush(self._send_item, max_items)

    # -- boot --------------------------------------------------------------------------------
    def boot(self) -> None:
        self.creds = self.creds_store.load()
        corrupt = self.journal.corrupt_lines
        self.journal.compact_if_needed()
        self.enqueue_device_event("boot", {"agentVersion": __version__, "bootId": self.boot_id,
                                           "journalCorruptLines": corrupt})
        for entry in self.journal.in_flight():
            log.warning("journal: cmd=%s stuck in state=%s → reporting interrupted", entry.command_id, entry.state)
            if entry.job_id and entry.lease_id:
                self.enqueue_job_event(entry.job_id, entry.lease_id, "interrupted",
                                       {"lastState": entry.state, "reason": "agent_restart"})
            self.journal.record(entry.command_id, J.INTERRUPTED, reason="agent_restart", lastState=entry.state)
        self._booted = True
        self.flush_outbox()

    # -- telemetry / hardware polling ----------------------------------------------------------
    def _printer_status(self) -> PrinterStatus:
        try:
            return self.printer.status()
        except Exception as e:  # adapters should not raise, but never let status kill the loop
            log.warning("printer status failed: %s", type(e).__name__)
            return PrinterStatus()

    def _reported_status(self, st: PrinterStatus) -> Dict[str, str]:
        """Only trusted (supported) readings are reported; unverified → "unsupported"."""
        p = self.printer
        paper = st.paper if (p.trusted("paperEnd") or p.trusted("nearEnd")) else "unsupported"
        cover = st.cover if p.trusted("coverOpen") else "unsupported"
        cutter = st.cutter if p.trusted("cutterStatus") else "unsupported"
        return {"paperSensor": paper, "cover": cover, "cutter": cutter}

    def capabilities_for_server(self) -> Dict[str, str]:
        def srv(v: str) -> str:
            return "supported" if v == "supported" else "unsupported"

        pc = self.power.capabilities()
        return {
            "power": srv(pc.get("power", "unsupported")),
            "battery": srv(pc.get("battery", "unsupported")),
            "nearEnd": srv(self.printer.capability("nearEnd")),
            "cutterStatus": srv(self.printer.capability("cutterStatus")),
            "chuteSensor": srv(self.chute.capability()),
            "camera": "unsupported",
        }

    def poll_hardware(self) -> Dict[str, Any]:
        st = self._printer_status()
        rep = self._reported_status(st)
        pw = self.power.status()
        chute_state = self.chute.state() if self.chute.capability() == "supported" else "unsupported"
        readings = {"paper": rep["paperSensor"], "cover": rep["cover"], "cutter": rep["cutter"],
                    "chute": chute_state, "power": pw.get("power", "unsupported")}
        self._emit_transitions(readings)
        return {"status": st, "reported": rep, "power": pw, "chute": chute_state}

    def _emit_transitions(self, now: Dict[str, str]) -> None:
        prev = self._last_readings
        first = not prev

        def changed(key: str) -> bool:
            return prev.get(key) != now[key]

        if changed("paper"):
            if now["paper"] == "paper_end":
                self.enqueue_device_event("paper_end")
            elif now["paper"] == "near_end":
                self.enqueue_device_event("paper_near_end")
            elif now["paper"] == "ok" and prev.get("paper") in ("paper_end", "near_end"):
                self.enqueue_device_event("paper_loaded")
        if changed("cover"):
            if now["cover"] == "open":
                self.enqueue_device_event("cover_open")
            elif now["cover"] == "closed" and prev.get("cover") == "open":
                self.enqueue_device_event("cover_closed")
        if changed("cutter") and now["cutter"] == "fault":
            self.enqueue_device_event("cutter_fault")
        if changed("chute") and now["chute"] in ("fault", "blocked"):
            self.enqueue_device_event("chute_sensor_fault", {"state": now["chute"]})
        if changed("power"):
            if now["power"] == "battery":
                self.enqueue_device_event("power_lost")
            elif now["power"] == "ac" and prev.get("power") == "battery":
                self.enqueue_device_event("power_restored")
        if first:
            log.debug("initial hardware readings recorded")
        self._last_readings = dict(now)

    def collect_telemetry(self) -> Dict[str, Any]:
        hw = self.poll_hardware()
        host = self.telemetry.collect()
        lat = self._transport.last_latency_ms if self._transport else None
        return {
            "network": host["network"],
            "signalDbm": host["signalDbm"],
            "latencyMs": lat,
            "power": hw["power"].get("power", "unsupported"),
            "batteryPct": hw["power"].get("batteryPct"),
            "paperSensor": hw["reported"]["paperSensor"],
            "cover": hw["reported"]["cover"],
            "cutter": hw["reported"]["cutter"],
            "chuteSensor": hw["chute"],
            "camera": "not_installed",
            "tempC": host["tempC"],
            "uptimeS": host["uptimeS"],
            "queueDepth": len(self.outbox),
            "capabilities": self.capabilities_for_server(),
        }

    # -- heartbeat ------------------------------------------------------------------------------
    def heartbeat_once(self) -> HeartbeatResult:
        self.seq += 1
        body = {"seq": self.seq, "agentVersion": __version__, "bootId": self.boot_id,
                "telemetry": self.collect_telemetry(), "activeJob": self.current_job}
        resp = self.transport.request("POST", "/heartbeat", body)
        data = resp.body if isinstance(resp.body, dict) else {}
        if isinstance(data.get("config"), dict):
            self.runtime.update(data["config"])
        self.server_paused = bool(data.get("paused", False))
        cmds = data.get("commands") if isinstance(data.get("commands"), list) else []
        log.debug("heartbeat seq=%d paused=%s jobAvailable=%s commands=%d", self.seq, self.server_paused,
                  data.get("jobAvailable"), len(cmds))
        return HeartbeatResult(bool(data.get("jobAvailable", False)), self.server_paused, cmds)

    # -- commands -------------------------------------------------------------------------------
    def handle_command(self, raw: Any) -> None:
        assert self.creds is not None
        now = self.clock.now()
        try:
            key = decode_command_key(self.creds.command_key)
            cmd = verify_command(raw, key, now)
        except (CommandRejected, ValueError) as e:
            reason = e.reason if isinstance(e, CommandRejected) else "bad_command_key"
            cid = raw.get("id") if isinstance(raw, dict) else None
            if isinstance(cid, str) and SAFE_ID_RE.match(cid):
                log.warning("command rejected id=%s reason=%s", cid, reason)
                if not self.seen.contains(cid):
                    self.seen.add(cid, (now + timedelta(days=1)).isoformat(), now)
                    self.enqueue_command_result(cid, CommandOutcome("failed", reason))
            else:
                log.warning("command rejected (no usable id) reason=%s", reason)
            return
        if self.seen.contains(cmd.id):
            log.debug("command id=%s already handled", cmd.id)
            return
        # Persist before executing: a crash mid-command must not re-run it (e.g. a second test print).
        self.seen.add(cmd.id, keep_until(cmd.expires_at, now), now)
        log.info("command accepted id=%s type=%s", cmd.id, cmd.type)
        try:
            outcome = self.execute(cmd)
        except Exception as e:
            log.error("command id=%s failed: %s", cmd.id, type(e).__name__)
            outcome = CommandOutcome("failed", f"error:{type(e).__name__}")
        self.enqueue_command_result(cmd.id, outcome)
        self.flush_outbox()
        if outcome.exit_code is not None:
            self.exit_code = outcome.exit_code

    def execute(self, cmd: Command) -> CommandOutcome:
        t = cmd.type
        if t == "test_print":
            return self.print_test_pattern()
        if t in ("pause", "resume"):
            self.local_paused = t == "pause"
            self._save_state()
            return CommandOutcome("succeeded", "paused" if self.local_paused else "resumed")
        if t == "clear_error":
            previous = self.hold_reason
            self.hold_reason = None
            self._save_state()
            self._last_readings.clear()  # re-evaluate & re-emit conditions on next poll
            return CommandOutcome("succeeded", "cleared", {"clearedHold": previous})
        if t == "diagnostics":
            return CommandOutcome("succeeded", "ok", {"diagnostics": self.diagnostics()})
        if t == "config_update":
            if not isinstance(cmd.payload, dict):
                return CommandOutcome("failed", "payload_must_be_object")
            unknown = self.runtime.update(dict(cmd.payload))
            if unknown:
                return CommandOutcome("failed", "unknown_keys", {"keys": sorted(unknown)[:20]})
            return CommandOutcome("succeeded", "applied", {"config": self.runtime.as_dict()})
        if t == "ota_update":
            # Remote code delivery is deliberately not implemented; updates are an operator
            # procedure (docs/DEVICE_AGENT_INSTALL.md → Updating).
            return CommandOutcome("failed", "ota_not_supported")
        if t in ("reboot_agent", "restart_service"):
            return self.hooks.run(t)
        return CommandOutcome("failed", "unknown_type")  # unreachable: verify_command enforces the set

    def print_test_pattern(self) -> CommandOutcome:
        page = test_pattern(min(self.cfg.printer.width_dots, 384) // 8 * 8, 240)
        try:
            err = self._printer_status().blocking_error()
            if err and (err == "printer_offline" or self.printer.trusted("realtimeStatus")):
                return CommandOutcome("failed", f"printer_error:{err}")
            self.printer.begin_job()
            self.printer.print_raster(page)
            self.printer.feed(12)
            cut = self.printer.cut("full")
        except PrinterError as e:
            return CommandOutcome("failed", f"printer_error:{e.code}")
        log.info("test pattern printed digest=%s cut=%s", page.digest, cut)
        return CommandOutcome("succeeded", "printed", {"digest": page.digest, "cutIssued": cut})

    # -- leasing / printing ---------------------------------------------------------------------
    def lease_once(self) -> bool:
        if self.paused:
            return False
        resp = self.transport.request("POST", "/jobs/lease", {"bootId": self.boot_id})
        if resp.status == 204 or not isinstance(resp.body, dict) or not resp.body.get("job"):
            return False
        # Stop leasing for this cycle after any failure (e.g. paper end) to avoid a hot loop.
        return self.process_job(resp.body["job"])

    def _post_print_started(self, lj: LeasedJob, data: Dict[str, Any]) -> Optional[str]:
        """Synchronous print_started. Returns "continue", "stop", or None (not acknowledged)."""
        item = self._job_event_body(lj.job_id, lj.lease_id, "print_started", data)
        remaining = (lj.lease_expires_at - self.clock.now()).total_seconds() - MIN_LEASE_REMAINING_S
        deadline = time.monotonic() + max(0.0, min(30.0, remaining))
        try:
            resp = self.transport.request_with_retry("POST", item.path, item.body, deadline_mono=deadline)
        except HttpError as e:
            if e.status in (404, 409, 410):
                return "stop"
            return None
        except TransportError:
            return None
        body = resp.body if isinstance(resp.body, dict) else {}
        nxt = body.get("next", "continue")
        return "stop" if nxt == "stop" else "continue"

    def _fail_before_print(self, lj: LeasedJob, error: str, **detail: Any) -> None:
        data = {"error": error, "phase": "before_print"}
        data.update(detail)
        self.journal.record(lj.command_id, J.FAILED_BEFORE_PRINT, job_id=lj.job_id, lease_id=lj.lease_id, error=error)
        self.enqueue_job_event(lj.job_id, lj.lease_id, "failed", data)
        self.flush_outbox()

    def process_job(self, job: Any) -> bool:
        """Handle one leased job. Returns True only if it was printed and cut without a printer error."""
        try:
            lj = _parse_lease(job)
        except ValueError:
            log.warning("lease response malformed; ignoring (lease will expire server-side)")
            return False
        log.info("leased job=%s cmd=%s lease=%s attempt=%s test=%s", lj.job_id, lj.command_id,
                 lj.lease_id, lj.attempt_no, lj.is_test)

        # Rule 2: never print a commandId twice.
        if not self.journal.can_print(lj.command_id):
            prev = self.journal.get(lj.command_id)
            log.warning("cmd=%s already journaled state=%s; NOT printing", lj.command_id, prev.state if prev else None)
            self.enqueue_job_event(lj.job_id, lj.lease_id, "interrupted",
                                   {"reason": "already_journaled", "lastState": prev.state if prev else None})
            self.flush_outbox()
            return False

        self.journal.record(lj.command_id, J.LEASED, job_id=lj.job_id, lease_id=lj.lease_id, attempt_no=lj.attempt_no)

        try:
            raster = parse_job_raster(lj.raster, self.cfg.printer.width_dots)
        except RasterInvalid as e:
            log.warning("job=%s raster invalid: %s", lj.job_id, e)
            self._fail_before_print(lj, "raster_invalid")
            return False
        if not raster.digest_verified:
            log.warning("job=%s multi-page digest not verifiable; proceeding", lj.job_id)

        if (lj.lease_expires_at - self.clock.now()).total_seconds() < MIN_LEASE_REMAINING_S:
            log.warning("job=%s lease (nearly) expired before print; releasing", lj.job_id)
            self.journal.record(lj.command_id, J.RELEASED, reason="lease_expired_locally")
            return False

        # Preflight: trusted printer status + chute.
        st = self._printer_status()
        err = st.blocking_error()
        if err and (err == "printer_offline" or self.printer.trusted("realtimeStatus")):
            self._fail_before_print(lj, err)
            self.poll_hardware()
            return False
        if raster.cut != "none" and self.printer.capability("cut") == "unsupported":
            self._fail_before_print(lj, "other", reason="cutter_unsupported")
            return False
        if self.chute.capability() == "supported" and self.chute.state() in ("blocked", "fault"):
            self._fail_before_print(lj, "other", reason=f"chute_{self.chute.state()}")
            self.poll_hardware()
            return False

        nxt = self._post_print_started(lj, {"digest": raster.digest, "pages": len(raster.pages)})
        if nxt == "stop":
            log.info("job=%s server said stop on print_started; not printing", lj.job_id)
            self.journal.record(lj.command_id, J.RELEASED, reason="server_stop")
            return False
        if nxt is None:
            log.warning("job=%s print_started not acknowledged; not printing", lj.job_id)
            self.journal.record(lj.command_id, J.RELEASED, reason="print_started_unacked")
            self.enqueue_job_event(lj.job_id, lj.lease_id, "failed",
                                   {"error": "other", "phase": "before_print", "reason": "print_started_unacked"})
            return False

        # Rule 1: durable "printing" before the first byte.
        try:
            self.journal.record(lj.command_id, J.PRINTING, digest=raster.digest)
        except OSError as e:
            log.error("job=%s journal write failed (%s); not printing", lj.job_id, type(e).__name__)
            self.enqueue_job_event(lj.job_id, lj.lease_id, "failed",
                                   {"error": "other", "phase": "before_print", "reason": "journal_write_failed"})
            return False

        self.current_job = {"jobId": lj.job_id, "leaseId": lj.lease_id, "phase": "printing"}
        try:
            return self._print_job(lj, raster)
        finally:
            self.current_job = None
            self.flush_outbox()

    def _print_job(self, lj: LeasedJob, raster: JobRaster) -> bool:
        phase = "during_print"
        pages = raster.pages
        cut_mode = raster.cut
        cut_confirmation = "command_sent"
        try:
            self.printer.begin_job()
            for i, page in enumerate(pages):
                phase = "during_print"
                try:
                    self.printer.print_raster(page)
                except PrinterError as e:
                    if i == 0 and not e.bytes_sent:
                        phase = "before_print"
                    raise
                phase = "after_print"
                self.printer.feed(raster.feed_before_cut_mm)
                if i == len(pages) - 1:
                    self.journal.record(lj.command_id, J.PRINTED)
                    self.enqueue_job_event(lj.job_id, lj.lease_id, "print_completed", {"pages": len(pages)})
                if cut_mode != "none":
                    if i == 0:
                        self.chute.arm()
                    if not self.printer.cut(cut_mode):
                        raise PrinterError("other", bytes_sent=True, detail="cut_not_issued")
                    if self.printer.trusted("cutterStatus"):
                        if self._printer_status().cutter == "fault":
                            raise PrinterError("cutter_jam", bytes_sent=True)
                        cut_confirmation = "status_ok"
        except PrinterError as e:
            log.warning("job=%s printer error code=%s phase=%s", lj.job_id, e.code, phase)
            state = J.FAILED_BEFORE_PRINT if phase == "before_print" else J.FAILED
            self.journal.record(lj.command_id, state, error=e.code, phase=phase)
            self.enqueue_job_event(lj.job_id, lj.lease_id, "failed", {"error": e.code, "phase": phase})
            if e.code == "cutter_jam":
                self.enqueue_device_event("cutter_fault")
                self._latch_hold("cutter_jam")
            self.poll_hardware()
            return False
        except Exception as e:
            log.error("job=%s unexpected error %s phase=%s", lj.job_id, type(e).__name__, phase)
            try:
                self.journal.record(lj.command_id, J.FAILED, error="other", phase=phase)
            finally:
                self.enqueue_job_event(lj.job_id, lj.lease_id, "failed", {"error": "other", "phase": phase})
            return False

        if cut_mode == "none":
            log.warning("job=%s cut=none: slip not separated; no cut/chute events", lj.job_id)
            self.journal.record(lj.command_id, J.PRINTED_NO_CUT)
            return True

        self.journal.record(lj.command_id, J.CUT)
        self.enqueue_job_event(lj.job_id, lj.lease_id, "cut_completed",
                               {"pages": len(pages), "confirmation": cut_confirmation})

        if self.chute.capability() == "supported":
            t0 = time.monotonic()
            drops = self.chute.wait_for_drops(len(pages), self.runtime.chute_timeout_ms / 1000.0)
            waited_ms = int((time.monotonic() - t0) * 1000)
            if drops >= len(pages):
                self.enqueue_job_event(lj.job_id, lj.lease_id, "chute_detected",
                                       {"drops": drops, "latencyMs": waited_ms})
                self.journal.record(lj.command_id, J.DELIVERED, confidence="sensor_confirmed")
                log.info("job=%s chute confirmed drops=%d", lj.job_id, drops)
            else:
                self.enqueue_job_event(lj.job_id, lj.lease_id, "chute_timeout",
                                       {"drops": drops, "expected": len(pages), "waitedMs": waited_ms})
                self.journal.record(lj.command_id, J.CHUTE_TIMEOUT, drops=drops)
                log.warning("job=%s chute timeout drops=%d expected=%d", lj.job_id, drops, len(pages))
                self._latch_hold("chute_timeout")
                return False
        else:
            self.journal.record(lj.command_id, J.DELIVERED, confidence="printer_reported")
            log.info("job=%s printed+cut (no chute sensor: printer_reported)", lj.job_id)
        return True

    # -- token rotation ----------------------------------------------------------------------
    def maybe_rotate_token(self) -> bool:
        assert self.creds is not None
        if self._creds_dirty:
            self._persist_creds()
        try:
            issued = parse_iso(self.creds.issued_at)
        except ValueError:
            issued = self.clock.now() - timedelta(days=self.cfg.token_rotate_days + 1)
        if self.clock.now() - issued < timedelta(days=self.cfg.token_rotate_days):
            return False
        resp = self.transport.request_with_retry("POST", "/token/rotate", {}, max_attempts=3)
        body = resp.body if isinstance(resp.body, dict) else {}
        token = body.get("token")
        if not isinstance(token, str) or not token.startswith("kvd_"):
            log.error("token rotation: malformed response; keeping current token")
            return False
        self.creds = replace(self.creds, token=token, issued_at=self.clock.iso_now())
        self._creds_dirty = True
        self._persist_creds()
        log.info("token rotated device=%s", self.creds.device_id)
        return True

    def _persist_creds(self) -> None:
        assert self.creds is not None
        try:
            self.creds_store.save(self.creds)
            self._creds_dirty = False
        except OSError as e:
            # The old token stays valid ~10 min server-side; keep retrying each loop.
            log.error("could not persist rotated token (%s); will retry", type(e).__name__)

    # -- diagnostics -------------------------------------------------------------------------
    def diagnostics(self) -> Dict[str, Any]:
        st = self._printer_status()
        return {
            "agentVersion": __version__,
            "bootId": self.boot_id,
            "deviceId": self.creds.device_id if self.creds else None,
            "serverUrl": self.creds.server_url if self.creds else (self.cfg.server_url or None),
            "paused": {"server": self.server_paused, "local": self.local_paused, "hold": self.hold_reason},
            "runtimeConfig": self.runtime.as_dict(),
            "printer": {"adapter": self.printer.name, "capabilities": self.printer.capabilities,
                        "status": st.as_dict()},
            "chute": {"capability": self.chute.capability(), "state": self.chute.state()},
            "power": {"capabilities": self.power.capabilities(), "status": self.power.status()},
            "host": self.telemetry.collect(),
            "journal": self.journal.summary(),
            "outbox": {"depth": len(self.outbox), "max": self.outbox.max_items,
                       "droppedTotal": self.outbox.dropped_total},
            "clock": {"offsetS": round(self.clock.offset_s, 3), "synced": self.clock.synced},
            "lastLatencyMs": self._transport.last_latency_ms if self._transport else None,
        }

    # -- main loop ---------------------------------------------------------------------------
    def _report_overflow(self) -> None:
        if self.outbox.dropped_unreported:
            n = self.outbox.dropped_unreported
            self.outbox.mark_overflow_reported()
            self.enqueue_device_event("spool_overflow", {"dropped": n})

    def run_cycle(self) -> float:
        """One loop iteration. Returns seconds to wait before the next one."""
        self.maybe_rotate_token()
        hb = self.heartbeat_once()
        for raw in hb.commands:
            self.handle_command(raw)
            if self.exit_code is not None:
                return 0.0
        self._report_overflow()
        self.flush_outbox()
        if hb.job_available and not self.paused:
            for _ in range(MAX_JOBS_PER_CYCLE):
                if self.exit_code is not None or not self.lease_once():
                    break
        return float(self.runtime.heartbeat_sec)

    def run(self, stop: threading.Event) -> int:
        if not self._booted:
            self.boot()
        failures = 0
        while not stop.is_set() and self.exit_code is None:
            try:
                wait = self.run_cycle()
                failures = 0
            except AuthError as e:
                failures += 1
                log.error("unauthorized (status=%s code=%s): token revoked or invalid; re-pair if persistent",
                          e.status, e.code)
                wait = max(60.0, self.backoff.delay(failures - 1))
            except (TransportError, HttpError) as e:
                failures += 1
                wait = self.backoff.delay(failures - 1)
                log.warning("server unreachable (%s); retry in %.1fs", type(e).__name__, wait)
            except Exception as e:
                failures += 1
                wait = self.backoff.delay(failures - 1)
                log.error("unexpected error in main loop: %s", type(e).__name__, exc_info=True)
            if self.exit_code is not None:
                break
            stop.wait(wait)
        self.printer.close()
        self.chute.close()
        return self.exit_code or 0


# --- pairing ------------------------------------------------------------------------------------

def normalize_pairing_code(code: str) -> str:
    import re

    c = code.strip().upper()
    if not re.match(PAIRING_CODE_RE, c):
        raise ValueError("pairing code must look like XXXX-XXXX")
    return c


def pair_device(
    cfg: AgentConfig,
    server_url: str,
    code: str,
    *,
    force: bool = False,
    clock: Optional[Clock] = None,
    hw_id: Optional[str] = None,
    transport_factory: Optional[Callable[[str, Clock], Transport]] = None,
) -> Credentials:
    store = CredentialStore(Path(cfg.token_file))
    if store.exists() and not force:
        raise ConfigError(f"already paired ({store.path}); use --force to re-pair")
    clock = clock or Clock()
    pairing_code = normalize_pairing_code(code)
    transport = (transport_factory or (lambda url, c: Transport(
        url, c, None, timeout_s=cfg.http_timeout_s, allow_insecure_http=cfg.allow_insecure_http, ca_file=cfg.ca_file,
    )))(server_url, clock)
    if hw_id is None:
        Path(cfg.spool_dir).mkdir(parents=True, exist_ok=True)
        hw_id = hardware_id(fallback_file=Path(cfg.spool_dir) / "hardware_id")
    body = {"pairingCode": pairing_code, "hardwareId": hw_id, "agentVersion": __version__,
            "printerModel": cfg.printer.model}
    resp = transport.request_with_retry("POST", "/pair", body, auth=False, max_attempts=4)
    data = resp.body if isinstance(resp.body, dict) else {}
    device_id, token, key = data.get("deviceId"), data.get("token"), data.get("commandKey")
    if not (isinstance(device_id, str) and isinstance(token, str) and token.startswith("kvd_") and isinstance(key, str)):
        raise ValueError("pairing response malformed")
    decode_command_key(key)  # validate before persisting
    creds = Credentials(device_id, token, key, clock.iso_now(), transport.server_url)
    store.save(creds)
    log.info("paired device=%s", device_id)
    return creds
