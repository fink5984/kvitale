"""Append-only print journal (``spool/journal.jsonl``), keyed by ``commandId``.

Each line is one state transition, written with fsync before the agent acts on
it. The rules (DEVICE_PROTOCOL.md "Device-side guarantees"):

* ``printing`` is fsync'd **before** any byte is sent to the printer.
* A ``commandId`` whose latest state is beyond the pre-print states is never
  printed again.
* On boot, entries left in an in-flight state are reported as ``interrupted``.

Pre-print states (``leased``, ``released``, ``failed_before_print``) mean no
byte of that job ever reached the printer, so they are equivalent to
``leased`` for the never-print-twice rule: the server may legitimately re-queue
such a job (e.g. after paper-end before print).
"""

from __future__ import annotations

import json
import logging
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .fsutil import append_line_fsync, atomic_write_bytes

log = logging.getLogger("kvittel.journal")

LEASED = "leased"
RELEASED = "released"                     # lease given back, nothing printed
FAILED_BEFORE_PRINT = "failed_before_print"
PRINTING = "printing"
PRINTED = "printed"
CUT = "cut"
DELIVERED = "delivered"                   # chute confirmed, or printer-reported when no chute sensor
CHUTE_TIMEOUT = "chute_timeout"
PRINTED_NO_CUT = "printed_no_cut"
FAILED = "failed"
INTERRUPTED = "interrupted"

PRE_PRINT_STATES = frozenset({LEASED, RELEASED, FAILED_BEFORE_PRINT})
IN_FLIGHT_STATES = frozenset({PRINTING, PRINTED, CUT})
TERMINAL_STATES = frozenset({DELIVERED, CHUTE_TIMEOUT, PRINTED_NO_CUT, FAILED, INTERRUPTED})
ALL_STATES = PRE_PRINT_STATES | IN_FLIGHT_STATES | TERMINAL_STATES

_KEEP_FIELDS = ("jobId", "leaseId", "attemptNo", "digest")


@dataclass
class JournalEntry:
    command_id: str
    state: str
    at: str
    job_id: Optional[str] = None
    lease_id: Optional[str] = None
    attempt_no: Optional[int] = None
    digest: Optional[str] = None
    extra: Dict[str, Any] = field(default_factory=dict)

    def to_record(self) -> Dict[str, Any]:
        rec: Dict[str, Any] = {"v": 1, "commandId": self.command_id, "state": self.state, "at": self.at}
        for k, v in (("jobId", self.job_id), ("leaseId", self.lease_id), ("attemptNo", self.attempt_no), ("digest", self.digest)):
            if v is not None:
                rec[k] = v
        if self.extra:
            rec["data"] = self.extra
        return rec


class Journal:
    COMPACT_THRESHOLD_LINES = 20000
    KEEP_COMMAND_IDS = 10000

    def __init__(self, path: Path, now_iso: Callable[[], str]) -> None:
        self.path = Path(path)
        self._now_iso = now_iso
        self._entries: Dict[str, JournalEntry] = {}
        self._order: List[str] = []  # commandIds by first appearance
        self._lines = 0
        self.corrupt_lines = 0
        self._lock = threading.Lock()
        self.load()

    # -- loading ---------------------------------------------------------------------
    def load(self) -> None:
        with self._lock:
            self._entries.clear()
            self._order.clear()
            self._lines = 0
            self.corrupt_lines = 0
            try:
                fh = open(self.path, "rb")
            except FileNotFoundError:
                return
            with fh:
                for raw in fh:
                    self._lines += 1
                    try:
                        rec = json.loads(raw.decode("utf-8"))
                        self._apply(rec)
                    except (ValueError, KeyError, TypeError, UnicodeDecodeError):
                        # Typically a torn final line after power loss. The previous
                        # complete line for that commandId still stands.
                        self.corrupt_lines += 1
            if self.corrupt_lines:
                log.warning("journal: skipped %d unreadable line(s)", self.corrupt_lines)

    def _apply(self, rec: Dict[str, Any]) -> None:
        cid, state = rec["commandId"], rec["state"]
        if not isinstance(cid, str) or state not in ALL_STATES:
            raise ValueError("bad record")
        prev = self._entries.get(cid)
        entry = JournalEntry(
            command_id=cid,
            state=state,
            at=str(rec.get("at", "")),
            job_id=rec.get("jobId", prev.job_id if prev else None),
            lease_id=rec.get("leaseId", prev.lease_id if prev else None),
            attempt_no=rec.get("attemptNo", prev.attempt_no if prev else None),
            digest=rec.get("digest", prev.digest if prev else None),
            extra=dict(rec.get("data") or {}),
        )
        if prev is None:
            self._order.append(cid)
        self._entries[cid] = entry

    # -- writing ---------------------------------------------------------------------
    def record(
        self,
        command_id: str,
        state: str,
        *,
        job_id: Optional[str] = None,
        lease_id: Optional[str] = None,
        attempt_no: Optional[int] = None,
        digest: Optional[str] = None,
        **extra: Any,
    ) -> JournalEntry:
        """Append + fsync one transition. Raises OSError if it could not be made durable."""
        if state not in ALL_STATES:
            raise ValueError(f"unknown journal state {state!r}")
        rec: Dict[str, Any] = {"v": 1, "commandId": command_id, "state": state, "at": self._now_iso()}
        for k, v in (("jobId", job_id), ("leaseId", lease_id), ("attemptNo", attempt_no), ("digest", digest)):
            if v is not None:
                rec[k] = v
        if extra:
            rec["data"] = extra
        line = json.dumps(rec, separators=(",", ":"), ensure_ascii=False)
        with self._lock:
            append_line_fsync(self.path, line)
            self._lines += 1
            self._apply(rec)
            entry = self._entries[command_id]
        log.debug("journal cmd=%s state=%s", command_id, state)
        return entry

    # -- queries ---------------------------------------------------------------------
    def get(self, command_id: str) -> Optional[JournalEntry]:
        return self._entries.get(command_id)

    def last_state(self, command_id: str) -> Optional[str]:
        e = self._entries.get(command_id)
        return e.state if e else None

    def can_print(self, command_id: str) -> bool:
        state = self.last_state(command_id)
        return state is None or state in PRE_PRINT_STATES

    def in_flight(self) -> List[JournalEntry]:
        return [self._entries[c] for c in self._order if self._entries[c].state in IN_FLIGHT_STATES]

    def __len__(self) -> int:
        return len(self._entries)

    @property
    def line_count(self) -> int:
        return self._lines

    # -- maintenance -----------------------------------------------------------------
    def compact(self, keep: Optional[int] = None) -> None:
        """Rewrite the journal with one line per commandId (atomic). In-flight entries are always kept."""
        keep = self.KEEP_COMMAND_IDS if keep is None else keep
        with self._lock:
            ids = self._order[-keep:] if keep > 0 else []
            keep_set = set(ids) | {c for c in self._order if self._entries[c].state in IN_FLIGHT_STATES}
            ordered = [c for c in self._order if c in keep_set]
            body = "".join(
                json.dumps(self._entries[c].to_record(), separators=(",", ":"), ensure_ascii=False) + "\n"
                for c in ordered
            ).encode("utf-8")
            atomic_write_bytes(self.path, body, 0o600)
            self._order = ordered
            self._entries = {c: self._entries[c] for c in ordered}
            self._lines = len(ordered)
            self.corrupt_lines = 0
        log.info("journal compacted entries=%d", len(ordered))

    def compact_if_needed(self) -> bool:
        if self._lines > self.COMPACT_THRESHOLD_LINES or self.corrupt_lines:
            self.compact()
            return True
        return False

    def summary(self) -> Dict[str, Any]:
        counts: Dict[str, int] = {}
        for e in self._entries.values():
            counts[e.state] = counts.get(e.state, 0) + 1
        return {
            "path": os.fspath(self.path),
            "entries": len(self._entries),
            "lines": self._lines,
            "corruptLines": self.corrupt_lines,
            "inFlight": [e.command_id for e in self.in_flight()],
            "states": counts,
        }
