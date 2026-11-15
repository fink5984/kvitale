import base64
import os
import subprocess
import unittest
from datetime import datetime, timedelta, timezone

from fake_server import iso, spec_signature
from kvittel_agent.commands import (
    EXIT_RESTART_REQUESTED, CommandRejected, HookRunner, canonical_json, compute_signature,
    decode_command_key, verify_command,
)
from kvittel_agent.config import HooksConfig

KEY = os.urandom(32)
NOW = datetime(2026, 11, 13, 12, 0, 0, tzinfo=timezone.utc)


def make(ctype="test_print", payload=None, *, cid="cmd-1", expires=NOW + timedelta(minutes=5), key=KEY, exp_str=None):
    exp = exp_str or iso(expires)
    return {"id": cid, "type": ctype, "payload": payload, "expiresAt": exp,
            "signature": spec_signature(key, cid, ctype, exp, payload)}


class SignatureTests(unittest.TestCase):
    def test_valid_command_accepted(self):
        cmd = verify_command(make(payload={"a": 1}), KEY, NOW)
        self.assertEqual((cmd.id, cmd.type, cmd.payload), ("cmd-1", "test_print", {"a": 1}))

    def test_null_payload_signs_as_empty_object(self):
        raw = make(payload=None)
        self.assertEqual(raw["signature"], spec_signature(KEY, "cmd-1", "test_print", raw["expiresAt"], {}))
        self.assertEqual(verify_command(raw, KEY, NOW).payload, {})

    def test_canonical_json_is_key_order_independent(self):
        # Server stores payloads in Postgres jsonb, which reorders keys.
        signed = make("config_update", {"heartbeatSec": 20, "chuteTimeoutMs": 9000, "nested": {"b": 1, "a": [2, 1]}})
        received = dict(signed)
        received["payload"] = {"nested": {"a": [2, 1], "b": 1}, "chuteTimeoutMs": 9000, "heartbeatSec": 20}
        self.assertEqual(verify_command(received, KEY, NOW).type, "config_update")

    def test_canonical_json_format(self):
        self.assertEqual(canonical_json({"b": 1, "a": {"d": "ש", "c": [1, 2]}}), '{"a":{"c":[1,2],"d":"ש"},"b":1}')

    def test_non_ascii_payload(self):
        verify_command(make(payload={"note": "צדיק — ok"}), KEY, NOW)

    def test_signature_message_matches_spec_formula(self):
        exp = "2026-11-13T12:05:00.000Z"
        self.assertEqual(compute_signature(KEY, "x", "pause", exp, {"z": 1, "a": 2}),
                         spec_signature(KEY, "x", "pause", exp, {"a": 2, "z": 1}))

    def test_expires_at_used_verbatim(self):
        # Same instant, different string → signature must not match (no re-formatting).
        raw = make(exp_str="2026-11-13T12:05:00.000Z")
        raw["expiresAt"] = "2026-11-13T12:05:00Z"
        with self.assertRaises(CommandRejected) as cm:
            verify_command(raw, KEY, NOW)
        self.assertEqual(cm.exception.reason, "bad_signature")

    def test_tampered_payload_rejected(self):
        raw = make(payload={"heartbeatSec": 15})
        raw["payload"] = {"heartbeatSec": 5}
        with self.assertRaises(CommandRejected) as cm:
            verify_command(raw, KEY, NOW)
        self.assertEqual(cm.exception.reason, "bad_signature")

    def test_tampered_type_rejected(self):
        raw = make("pause")
        raw["type"] = "resume"
        with self.assertRaises(CommandRejected) as cm:
            verify_command(raw, KEY, NOW)
        self.assertEqual(cm.exception.reason, "bad_signature")

    def test_wrong_key_rejected(self):
        with self.assertRaises(CommandRejected) as cm:
            verify_command(make(key=os.urandom(32)), KEY, NOW)
        self.assertEqual(cm.exception.reason, "bad_signature")

    def test_garbage_signature_rejected(self):
        raw = make()
        raw["signature"] = "not-hex"
        with self.assertRaises(CommandRejected) as cm:
            verify_command(raw, KEY, NOW)
        self.assertEqual(cm.exception.reason, "bad_signature")

    def test_expired_rejected(self):
        with self.assertRaises(CommandRejected) as cm:
            verify_command(make(expires=NOW - timedelta(seconds=1)), KEY, NOW)
        self.assertEqual(cm.exception.reason, "expired")
        with self.assertRaises(CommandRejected):
            verify_command(make(expires=NOW), KEY, NOW)  # boundary: expiresAt == now is expired

    def test_unknown_type_rejected_even_if_signed(self):
        with self.assertRaises(CommandRejected) as cm:
            verify_command(make("shell", {"cmd": "rm -rf /"}), KEY, NOW)
        self.assertEqual(cm.exception.reason, "unknown_type")

    def test_malformed(self):
        for raw in (None, [], {"id": "x"}, {**make(), "id": "../../etc"}, {**make(), "expiresAt": 5}):
            with self.assertRaises(CommandRejected) as cm:
                verify_command(raw, KEY, NOW)
            self.assertEqual(cm.exception.reason, "malformed")

    def test_decode_command_key(self):
        self.assertEqual(decode_command_key(base64.b64encode(KEY).decode()), KEY)
        self.assertEqual(decode_command_key(base64.urlsafe_b64encode(KEY).decode().rstrip("=")), KEY)
        with self.assertRaises(ValueError):
            decode_command_key("c2hvcnQ=")


class HookTests(unittest.TestCase):
    def test_disabled_by_default(self):
        out = HookRunner(HooksConfig()).run("reboot_agent")
        self.assertEqual((out.status, out.message, out.exit_code), ("failed", "disabled_by_config", None))

    def test_exit_hook(self):
        out = HookRunner(HooksConfig(restart_service="exit")).run("restart_service")
        self.assertEqual((out.status, out.exit_code), ("succeeded", EXIT_RESTART_REQUESTED))

    def test_argv_hook_runs_without_shell(self):
        calls = []

        def fake_run(argv, **kw):
            calls.append((argv, kw))
            return subprocess.CompletedProcess(argv, 0)

        out = HookRunner(HooksConfig(reboot_agent=["/usr/bin/systemctl", "reboot"]), runner=fake_run).run("reboot_agent")
        self.assertEqual(out.status, "succeeded")
        argv, kw = calls[0]
        self.assertEqual(argv, ["/usr/bin/systemctl", "reboot"])
        self.assertIs(kw["shell"], False)


if __name__ == "__main__":
    unittest.main()
