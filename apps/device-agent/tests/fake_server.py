"""Minimal in-process implementation of the device protocol for tests.

Implements: /pair, /heartbeat, /jobs/lease, /jobs/{id}/events, /events,
/commands/{id}/result, /token/rotate — with a tiny job state machine and
fault-injection knobs. Signatures are computed independently of the agent code
(straight from the spec) so the tests check the agent against the contract.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, List, Optional, Tuple

PREFIX = "/api/device/v1"


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def spec_signature(key: bytes, cid: str, ctype: str, expires_at: str, payload: Any) -> str:
    canon = json.dumps({} if payload is None else payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    msg = f"{cid}.{ctype}.{expires_at}.{hashlib.sha256(canon.encode('utf-8')).hexdigest()}"
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).hexdigest()


def fnv1a32(data: bytes) -> int:
    h = 0x811C9DC5
    for b in data:
        h = ((h ^ b) * 0x01000193) & 0xFFFFFFFF
    return h


def make_raster(width: int = 384, heights: Tuple[int, ...] = (64,), seed: int = 7) -> Dict[str, Any]:
    bpr = (width + 7) // 8
    pages = []
    datas = []
    for n, h in enumerate(heights):
        data = bytes(((i * 31 + seed + n) & 0xFF) for i in range(bpr * h))
        datas.append(data)
        pages.append({"heightDots": h, "data": base64.b64encode(data).decode()})
    if len(heights) == 1:
        digest = f"{width}x{heights[0]}-{fnv1a32(datas[0]):08x}"
    else:
        digest = f"{width}x{sum(heights)}-{fnv1a32(b''.join(datas)):08x}"
    return {"format": "packed-1bpp-msb", "widthDots": width, "bytesPerRow": bpr, "pages": pages,
            "digest": digest, "lengthMm": sum(heights) / 8.0, "feedBeforeCutMm": 12, "cut": "full"}


class FakeServer:
    def __init__(self) -> None:
        self.command_key = os.urandom(32)
        self.command_key_b64 = base64.b64encode(self.command_key).decode()
        self.pairing_codes = {"7H2K-9QXD"}
        self.tokens: Dict[str, str] = {}
        self.queue: List[Dict[str, Any]] = []          # jobs waiting to be leased
        self.jobs: Dict[str, Dict[str, Any]] = {}      # jobId -> {status, leaseId, commandId, ...}
        self.pending_commands: List[Dict[str, Any]] = []
        self.event_attempts: List[Tuple[str, str, bool]] = []  # (eventUid, type, accepted)
        self.accepted_events: List[Dict[str, Any]] = []
        self.device_events: List[Dict[str, Any]] = []
        self.command_results: Dict[str, Dict[str, Any]] = {}
        self.heartbeats: List[Dict[str, Any]] = []
        self.fail_event_types: Dict[str, int] = {}
        self.fail_heartbeats = 0
        self.print_started_next = "continue"
        self.paused = False
        self.config = {"version": 1, "heartbeatSec": 15, "leaseSec": 90, "chuteTimeoutMs": 2000}
        self.rotations = 0
        self.lock = threading.Lock()
        self._seen_uids: set = set()
        self._lease_seq = 0
        self._httpd: Optional[ThreadingHTTPServer] = None

    # -- lifecycle --------------------------------------------------------------------
    def start(self) -> "FakeServer":
        server = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args: Any) -> None:  # silence
                pass

            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length") or 0)
                raw = self.rfile.read(length) if length else b""
                try:
                    body = json.loads(raw) if raw else {}
                except json.JSONDecodeError:
                    return self._send(400, {"error": "bad_json"})
                auth = self.headers.get("Authorization", "")
                status, payload = server.handle(self.path, body, auth)
                self._send(status, payload)

            def _send(self, status: int, payload: Optional[Dict[str, Any]]) -> None:
                data = b"" if payload is None else json.dumps(payload).encode()
                self.send_response(status)
                if data:
                    self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                if data:
                    self.wfile.write(data)

        self._httpd = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self._httpd.daemon_threads = True
        threading.Thread(target=self._httpd.serve_forever, daemon=True).start()
        return self

    def stop(self) -> None:
        if self._httpd:
            self._httpd.shutdown()
            self._httpd.server_close()

    @property
    def url(self) -> str:
        assert self._httpd
        return f"http://127.0.0.1:{self._httpd.server_address[1]}"

    # -- helpers for tests ---------------------------------------------------------------
    def add_job(self, job_id: str = "job-1", command_id: str = "cmd_1", raster: Optional[Dict[str, Any]] = None,
                lease_seconds: int = 90) -> None:
        with self.lock:
            self.queue.append({"jobId": job_id, "commandId": command_id, "raster": raster or make_raster(),
                               "leaseSeconds": lease_seconds, "attemptNo": 0})
            self.jobs[job_id] = {"status": "queued", "commandId": command_id}

    def add_command(self, ctype: str, payload: Any = None, *, cid: Optional[str] = None,
                    expires_in_s: int = 300, bad_signature: bool = False) -> str:
        cid = cid or f"c-{len(self.pending_commands)}-{ctype}"
        exp = iso(now_utc() + timedelta(seconds=expires_in_s))
        sig = spec_signature(self.command_key, cid, ctype, exp, payload)
        if bad_signature:
            sig = ("0" if sig[0] != "0" else "1") + sig[1:]
        with self.lock:
            self.pending_commands.append({"id": cid, "type": ctype, "payload": payload, "expiresAt": exp, "signature": sig})
        return cid

    def events_for(self, job_id: str) -> List[str]:
        return [e["type"] for e in self.accepted_events if e["_jobId"] == job_id]

    # -- protocol ----------------------------------------------------------------------------
    def _base(self) -> Dict[str, Any]:
        return {"serverTime": iso(now_utc())}

    def handle(self, path: str, body: Dict[str, Any], auth: str) -> Tuple[int, Optional[Dict[str, Any]]]:
        if not path.startswith(PREFIX):
            return 404, {"error": "not_found"}
        p = path[len(PREFIX):]
        if p == "/pair":
            code = body.get("pairingCode")
            with self.lock:
                if code not in self.pairing_codes:
                    return 400, {"error": "invalid_code", **self._base()}
                self.pairing_codes.discard(code)
                token = "kvd_" + base64.urlsafe_b64encode(os.urandom(24)).decode().rstrip("=")
                self.tokens[token] = "dev-1"
            return 200, {"deviceId": "dev-1", "token": token, "commandKey": self.command_key_b64,
                         **self._base(), "config": self.config}
        token = auth[7:] if auth.startswith("Bearer ") else ""
        if token not in self.tokens:
            return 401, {"error": "unauthorized", **self._base()}

        if p == "/heartbeat":
            with self.lock:
                if self.fail_heartbeats > 0:
                    self.fail_heartbeats -= 1
                    return 503, {"error": "unavailable"}
                self.heartbeats.append(body)
                cmds, self.pending_commands = self.pending_commands, []
                return 200, {**self._base(), "paused": self.paused, "config": self.config,
                             "jobAvailable": bool(self.queue), "commands": cmds}
        if p == "/jobs/lease":
            with self.lock:
                if not self.queue:
                    return 204, None
                q = self.queue.pop(0)
                self._lease_seq += 1
                q["attemptNo"] += 1
                lease_id = f"lease_{self._lease_seq}"
                self.jobs[q["jobId"]].update(status="leased", leaseId=lease_id, _q=q)
                return 200, {"job": {"jobId": q["jobId"], "commandId": q["commandId"], "leaseId": lease_id,
                                     "leaseExpiresAt": iso(now_utc() + timedelta(seconds=q["leaseSeconds"])),
                                     "attemptNo": q["attemptNo"], "raster": q["raster"], "isTest": False}}
        m = re.fullmatch(r"/jobs/([^/]+)/events", p)
        if m:
            return self._job_event(m.group(1), body)
        if p == "/events":
            with self.lock:
                for ev in body.get("events", []):
                    if ev["eventUid"] not in self._seen_uids:
                        self._seen_uids.add(ev["eventUid"])
                        self.device_events.append(ev)
            return 200, {"ok": True, **self._base()}
        m = re.fullmatch(r"/commands/([^/]+)/result", p)
        if m:
            with self.lock:
                self.command_results[m.group(1)] = body
            return 200, {"ok": True, **self._base()}
        if p == "/token/rotate":
            with self.lock:
                new = "kvd_" + base64.urlsafe_b64encode(os.urandom(24)).decode().rstrip("=")
                self.tokens[new] = self.tokens[token]
                self.rotations += 1
            return 200, {"token": new, **self._base()}
        return 404, {"error": "not_found"}

    def _job_event(self, job_id: str, body: Dict[str, Any]) -> Tuple[int, Optional[Dict[str, Any]]]:
        etype, uid = body.get("type"), body.get("eventUid")
        with self.lock:
            job = self.jobs.get(job_id)
            if job is None:
                return 404, {"error": "unknown_job"}
            if self.fail_event_types.get(etype, 0) > 0:
                self.fail_event_types[etype] -= 1
                self.event_attempts.append((uid, etype, False))
                return 503, {"error": "unavailable"}
            self.event_attempts.append((uid, etype, True))
            if uid in self._seen_uids:  # idempotent duplicate
                return 200, {"status": job["status"], "next": "continue", **self._base()}
            if body.get("leaseId") != job.get("leaseId"):
                return 200, {"status": job["status"], "next": "stop", **self._base()}
            self._seen_uids.add(uid)
            self.accepted_events.append({**body, "_jobId": job_id})
            nxt = "continue"
            if etype == "print_started":
                nxt = self.print_started_next
                if nxt == "continue":
                    job["status"] = "printing"
            elif etype == "print_completed":
                job["status"] = "printed"
            elif etype == "cut_completed":
                job["status"] = "cut"
            elif etype == "chute_detected":
                job["status"] = "delivered"
            elif etype in ("chute_timeout", "interrupted"):
                job["status"] = "uncertain"
            elif etype == "failed":
                if body.get("data", {}).get("phase") == "before_print":
                    job["status"] = "queued"
                    self.queue.append(job["_q"])
                else:
                    job["status"] = "uncertain"
            return 200, {"status": job["status"], "next": nxt, **self._base()}
