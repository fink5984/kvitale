import tempfile
import unittest
from pathlib import Path

from kvittel_agent import journal as J
from kvittel_agent.journal import Journal
from kvittel_agent.outbox import (
    KIND_COMMAND_RESULT, KIND_DEVICE_EVENT, KIND_JOB_EVENT, Outbox, OutboxItem, SendResult,
)


def now() -> str:
    return "2026-11-13T12:00:00.000Z"


class JournalTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "journal.jsonl"

    def tearDown(self):
        self.tmp.cleanup()

    def test_never_print_twice_across_restart(self):
        j = Journal(self.path, now)
        self.assertTrue(j.can_print("cmd_1"))
        j.record("cmd_1", J.LEASED, job_id="job-1", lease_id="lease_1")
        self.assertTrue(j.can_print("cmd_1"))  # leased only: nothing physical yet
        j.record("cmd_1", J.PRINTING, digest="384x64-deadbeef")
        self.assertFalse(j.can_print("cmd_1"))
        j2 = Journal(self.path, now)  # "reboot"
        self.assertFalse(j2.can_print("cmd_1"))
        self.assertEqual(j2.get("cmd_1").lease_id, "lease_1")  # fields carried from earlier lines

    def test_in_flight_reported_on_restart(self):
        j = Journal(self.path, now)
        j.record("a", J.LEASED, job_id="ja", lease_id="la")
        j.record("a", J.PRINTING)
        j.record("b", J.LEASED, job_id="jb", lease_id="lb")
        j.record("b", J.PRINTING)
        j.record("b", J.PRINTED)
        j.record("b", J.CUT)
        j.record("b", J.DELIVERED)
        j.record("c", J.LEASED, job_id="jc", lease_id="lc")
        j2 = Journal(self.path, now)
        self.assertEqual([(e.command_id, e.state, e.job_id) for e in j2.in_flight()], [("a", J.PRINTING, "ja")])

    def test_pre_print_failures_may_be_retried(self):
        j = Journal(self.path, now)
        for state in (J.RELEASED, J.FAILED_BEFORE_PRINT):
            j.record("x", state)
            self.assertTrue(j.can_print("x"))
        for state in (J.FAILED, J.INTERRUPTED, J.CHUTE_TIMEOUT, J.DELIVERED):
            j.record("y-" + state, state)
            self.assertFalse(j.can_print("y-" + state))

    def test_torn_last_line_is_tolerated(self):
        j = Journal(self.path, now)
        j.record("cmd_1", J.LEASED, job_id="j", lease_id="l")
        j.record("cmd_1", J.PRINTING)
        with open(self.path, "ab") as fh:
            fh.write(b'{"v":1,"commandId":"cmd_1","sta')  # power loss mid-append
        j2 = Journal(self.path, now)
        self.assertEqual(j2.corrupt_lines, 1)
        self.assertEqual(j2.last_state("cmd_1"), J.PRINTING)
        self.assertFalse(j2.can_print("cmd_1"))

    def test_compaction_keeps_state_and_in_flight(self):
        j = Journal(self.path, now)
        j.record("old", J.LEASED, job_id="j0", lease_id="l0")
        j.record("old", J.PRINTING)  # in flight: must survive compaction
        for i in range(10):
            j.record(f"c{i}", J.LEASED)
            j.record(f"c{i}", J.DELIVERED)
        j.compact(keep=3)
        j2 = Journal(self.path, now)
        self.assertEqual(j2.line_count, 4)
        self.assertEqual(j2.last_state("old"), J.PRINTING)
        self.assertEqual(j2.last_state("c9"), J.DELIVERED)
        self.assertIsNone(j2.get("c0"))

    def test_unknown_state_rejected(self):
        with self.assertRaises(ValueError):
            Journal(self.path, now).record("x", "bogus")


def item(uid: str, kind: str = KIND_JOB_EVENT) -> OutboxItem:
    return OutboxItem(uid=uid, kind=kind, path="/x", body={"eventUid": uid}, enqueued_at=now())


class OutboxTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "outbox.json"

    def tearDown(self):
        self.tmp.cleanup()

    def test_persistence_and_order(self):
        ob = Outbox(self.path)
        for u in ("a", "b", "c"):
            ob.enqueue(item(u))
        ob2 = Outbox(self.path)
        self.assertEqual([i.uid for i in ob2.items()], ["a", "b", "c"])

    def test_idempotent_enqueue(self):
        ob = Outbox(self.path)
        ob.enqueue(item("a"))
        ob.enqueue(item("a"))
        self.assertEqual(len(ob), 1)

    def test_default_bound_is_500(self):
        self.assertEqual(Outbox(self.path).max_items, 500)

    def test_bound_and_drop_policy(self):
        ob = Outbox(self.path, max_items=3)
        ob.enqueue(item("j1"))
        ob.enqueue(item("d1", KIND_DEVICE_EVENT))
        ob.enqueue(item("r1", KIND_COMMAND_RESULT))
        dropped = ob.enqueue(item("j2"))
        self.assertEqual(dropped.uid, "d1")  # device events go first
        dropped = ob.enqueue(item("j3"))
        self.assertEqual(dropped.uid, "r1")
        dropped = ob.enqueue(item("j4"))
        self.assertEqual(dropped.uid, "j1")
        self.assertEqual([i.uid for i in ob.items()], ["j2", "j3", "j4"])
        self.assertEqual(Outbox(self.path, max_items=3).dropped_unreported, 3)

    def test_flush_stops_at_first_retry_and_keeps_order(self):
        ob = Outbox(self.path)
        for u in ("a", "b", "c"):
            ob.enqueue(item(u))
        sent = []

        def send(it):
            sent.append(it.uid)
            return SendResult.RETRY if it.uid == "b" else SendResult.OK

        self.assertEqual(ob.flush(send), 1)
        self.assertEqual(sent, ["a", "b"])
        self.assertEqual([i.uid for i in Outbox(self.path).items()], ["b", "c"])
        self.assertEqual(Outbox(self.path).items()[0].attempts, 1)
        self.assertEqual(ob.flush(lambda it: SendResult.OK), 2)
        self.assertEqual(len(Outbox(self.path)), 0)

    def test_drop_removes_poison_item(self):
        ob = Outbox(self.path)
        ob.enqueue(item("bad"))
        ob.enqueue(item("good"))
        self.assertEqual(ob.flush(lambda it: SendResult.DROP if it.uid == "bad" else SendResult.OK), 2)

    def test_sender_exception_keeps_item(self):
        ob = Outbox(self.path)
        ob.enqueue(item("a"))

        def boom(it):
            raise RuntimeError("x")

        self.assertEqual(ob.flush(boom), 0)
        self.assertEqual(len(ob), 1)


if __name__ == "__main__":
    unittest.main()
