"""Signed remote commands: verification, de-duplication and safe hooks.

Signature (DEVICE_PROTOCOL.md rule 5)::

    hex(HMAC_SHA256(base64decode(commandKey),
        id + "." + type + "." + expiresAt + "." + sha256hex(canonicalJson(payload ?? {}))))

``canonicalJson`` = keys sorted at every level, ``,``/``:`` separators, no
whitespace, non-ASCII emitted as UTF-8. ``expiresAt`` is the exact string the
server sent (never re-formatted).

There is no shell command. ``reboot_agent``/``restart_service`` map to local,
operator-configured hooks that default to *disabled*; command payloads never
influence what is executed.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import logging
import re
import subprocess
import threading
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Callable, Dict, Mapping, Optional

from .clock import parse_iso
from .config import HookSpec, HooksConfig
from .fsutil import atomic_write_json, read_json

log = logging.getLogger("kvittel.commands")

ALLOWED_COMMAND_TYPES = frozenset({
    "test_print", "pause", "resume", "reboot_agent", "restart_service",
    "clear_error", "diagnostics", "config_update", "ota_update",
})
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,128}$")
_HEX_RE = re.compile(r"^[0-9a-fA-F]{64}$")

#: Exit code used by the "exit" hook; systemd ``Restart=always`` restarts the unit.
EXIT_RESTART_REQUESTED = 75


class CommandRejected(Exception):
    def __init__(self, reason: str) -> None:
        super().__init__(reason)
        self.reason = reason  # malformed | bad_signature | unknown_type | expired


@dataclass(frozen=True)
class Command:
    id: str
    type: str
    payload: Any
    expires_at: str


def canonical_json(obj: Any) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def decode_command_key(command_key: str) -> bytes:
    s = command_key.strip()
    s += "=" * (-len(s) % 4)
    try:
        if "-" in s or "_" in s:
            key = base64.urlsafe_b64decode(s)
        else:
            key = base64.b64decode(s, validate=True)
    except (binascii.Error, ValueError):
        raise ValueError("commandKey is not valid base64") from None
    if len(key) < 16:
        raise ValueError("commandKey too short")
    return key


def signing_message(command_id: str, command_type: str, expires_at: str, payload: Any) -> bytes:
    body = canonical_json({} if payload is None else payload).encode("utf-8")
    digest = hashlib.sha256(body).hexdigest()
    return f"{command_id}.{command_type}.{expires_at}.{digest}".encode("utf-8")


def compute_signature(key: bytes, command_id: str, command_type: str, expires_at: str, payload: Any) -> str:
    return hmac.new(key, signing_message(command_id, command_type, expires_at, payload), hashlib.sha256).hexdigest()


def verify_command(raw: Any, key: bytes, now: datetime) -> Command:
    """Return a verified :class:`Command` or raise :class:`CommandRejected`.

    Order: structure → signature → type → expiry, so only authentic commands get
    past the signature check and expiry/type are judged on signed data.
    """
    if not isinstance(raw, Mapping):
        raise CommandRejected("malformed")
    cid, ctype, exp, sig = raw.get("id"), raw.get("type"), raw.get("expiresAt"), raw.get("signature")
    if not all(isinstance(v, str) for v in (cid, ctype, exp, sig)):
        raise CommandRejected("malformed")
    if not SAFE_ID_RE.match(cid):
        raise CommandRejected("malformed")
    payload = raw.get("payload")
    if payload is None:
        payload = {}
    try:
        expected = compute_signature(key, cid, ctype, exp, payload)
    except (TypeError, ValueError, UnicodeEncodeError):
        raise CommandRejected("malformed") from None
    if not _HEX_RE.match(sig) or not hmac.compare_digest(expected, sig.lower()):
        raise CommandRejected("bad_signature")
    if ctype not in ALLOWED_COMMAND_TYPES:
        raise CommandRejected("unknown_type")
    try:
        exp_dt = parse_iso(exp)
    except ValueError:
        raise CommandRejected("malformed") from None
    if now >= exp_dt:
        raise CommandRejected("expired")
    return Command(cid, ctype, payload, exp)


# --- de-duplication -----------------------------------------------------------------

class SeenCommands:
    """Persistent set of handled command ids (at-most-once execution across restarts)."""

    MAX = 2000

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        data = read_json(self.path, default={})
        self._seen: Dict[str, str] = dict(data.get("seen", {})) if isinstance(data, dict) else {}
        self._lock = threading.Lock()

    def contains(self, command_id: str) -> bool:
        return command_id in self._seen

    def add(self, command_id: str, keep_until_iso: str, now: datetime) -> None:
        with self._lock:
            self._seen[command_id] = keep_until_iso
            self._prune(now)
            atomic_write_json(self.path, {"v": 1, "seen": self._seen})

    def _prune(self, now: datetime) -> None:
        horizon = now - timedelta(days=1)
        for cid, until in list(self._seen.items()):
            try:
                if parse_iso(until) < horizon:
                    del self._seen[cid]
            except ValueError:
                del self._seen[cid]
        while len(self._seen) > self.MAX:
            del self._seen[next(iter(self._seen))]


# --- hooks ------------------------------------------------------------------------------

@dataclass
class CommandOutcome:
    status: str  # "succeeded" | "failed"
    message: str
    extra: Dict[str, Any] = field(default_factory=dict)
    exit_code: Optional[int] = None

    def result_body(self) -> Dict[str, Any]:
        result: Dict[str, Any] = {"message": self.message}
        result.update(self.extra)
        return {"status": self.status, "result": result}


_HOOK_ENV = {"PATH": "/usr/sbin:/usr/bin:/sbin:/bin", "LANG": "C.UTF-8"}


class HookRunner:
    def __init__(self, hooks: HooksConfig, runner: Callable[..., Any] = subprocess.run, timeout_s: float = 30.0) -> None:
        self._hooks: Dict[str, HookSpec] = {
            "reboot_agent": hooks.reboot_agent,
            "restart_service": hooks.restart_service,
        }
        self._runner = runner
        self._timeout_s = timeout_s

    def spec(self, name: str) -> HookSpec:
        return self._hooks.get(name, "disabled")

    def run(self, name: str) -> CommandOutcome:
        spec = self.spec(name)
        if spec == "disabled":
            log.warning("hook %s requested but disabled by config; not executed", name)
            return CommandOutcome("failed", "disabled_by_config")
        if spec == "exit":
            log.warning("hook %s: agent will exit with code %d for systemd restart", name, EXIT_RESTART_REQUESTED)
            return CommandOutcome("succeeded", "exiting_for_restart", exit_code=EXIT_RESTART_REQUESTED)
        assert isinstance(spec, list)
        log.warning("hook %s: running configured argv[0]=%s", name, spec[0])
        try:
            proc = self._runner(
                list(spec), shell=False, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL, timeout=self._timeout_s, env=dict(_HOOK_ENV), check=False,
            )
        except (OSError, subprocess.SubprocessError) as e:
            return CommandOutcome("failed", f"hook_error:{type(e).__name__}")
        rc = getattr(proc, "returncode", 1)
        return CommandOutcome("succeeded" if rc == 0 else "failed", f"hook_exit:{rc}")


def keep_until(cmd_expires_at: str, now: datetime) -> str:
    try:
        exp = parse_iso(cmd_expires_at)
    except ValueError:
        exp = now
    return max(exp, now).astimezone(timezone.utc).isoformat()
