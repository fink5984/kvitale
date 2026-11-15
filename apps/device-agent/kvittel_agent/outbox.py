"""Bounded persistent outbox for event / result uploads.

Items are retried strictly in order (flush stops at the first item that must be
retried). Each item carries its ``eventUid`` from the moment it is enqueued,
so every retry — including after a reboot — is idempotent on the server.

Overflow policy (default bound 500): drop the oldest *device-level* event first,
then the oldest command result, and only then the oldest job event. Drops are
counted so the agent can report ``spool_overflow``. A dropped job event is not
silent data loss on the server side: the lease expires and the job becomes
``uncertain`` for human review.
"""

from __future__ import annotations

import enum
import logging
import threading
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

from .fsutil import atomic_write_json, read_json

log = logging.getLogger("kvittel.outbox")

KIND_DEVICE_EVENT = "device_event"
KIND_COMMAND_RESULT = "command_result"
KIND_JOB_EVENT = "job_event"
_DROP_ORDER = (KIND_DEVICE_EVENT, KIND_COMMAND_RESULT, KIND_JOB_EVENT)


class SendResult(enum.Enum):
    OK = "ok"        # delivered (or server says duplicate) → remove
    RETRY = "retry"  # transient → stop flushing, keep item
    DROP = "drop"    # permanent rejection (e.g. 400/404/410) → remove, log


@dataclass
class OutboxItem:
    uid: str
    kind: str
    path: str
    body: Dict[str, Any]
    enqueued_at: str
    attempts: int = 0
    meta: Dict[str, Any] = field(default_factory=dict)  # ids/types only, used for logging


class Outbox:
    def __init__(self, path: Path, max_items: int = 500) -> None:
        if max_items < 1:
            raise ValueError("max_items must be >= 1")
        self.path = Path(path)
        self.max_items = max_items
        self._items: List[OutboxItem] = []
        self.dropped_total = 0
        self.dropped_unreported = 0
        self._lock = threading.RLock()
        self._load()

    def _load(self) -> None:
        data = read_json(self.path, default=None)
        if not isinstance(data, dict):
            return
        for raw in data.get("items", []):
            try:
                self._items.append(OutboxItem(**raw))
            except TypeError:
                log.warning("outbox: skipped malformed item")
        self.dropped_total = int(data.get("droppedTotal", 0))
        self.dropped_unreported = int(data.get("droppedUnreported", 0))

    def _persist(self) -> None:
        atomic_write_json(
            self.path,
            {
                "v": 1,
                "droppedTotal": self.dropped_total,
                "droppedUnreported": self.dropped_unreported,
                "items": [asdict(i) for i in self._items],
            },
        )

    def __len__(self) -> int:
        return len(self._items)

    def items(self) -> List[OutboxItem]:
        with self._lock:
            return list(self._items)

    def contains(self, uid: str) -> bool:
        with self._lock:
            return any(i.uid == uid for i in self._items)

    def enqueue(self, item: OutboxItem) -> Optional[OutboxItem]:
        """Persist ``item``. Idempotent by uid. Returns the item dropped to make room, if any."""
        with self._lock:
            if any(i.uid == item.uid for i in self._items):
                return None
            dropped: Optional[OutboxItem] = None
            if len(self._items) >= self.max_items:
                for kind in _DROP_ORDER:
                    idx = next((n for n, i in enumerate(self._items) if i.kind == kind), None)
                    if idx is not None:
                        dropped = self._items.pop(idx)
                        break
                self.dropped_total += 1
                self.dropped_unreported += 1
                if dropped is not None:
                    log.warning("outbox full: dropped kind=%s uid=%s meta=%s", dropped.kind, dropped.uid, dropped.meta)
            self._items.append(item)
            self._persist()
            return dropped

    def mark_overflow_reported(self) -> None:
        with self._lock:
            self.dropped_unreported = 0
            self._persist()

    def flush(self, send: Callable[[OutboxItem], SendResult], max_items: Optional[int] = None) -> int:
        """Send queued items in order. Returns the number removed (sent or dropped)."""
        removed = 0
        while True:
            with self._lock:
                if not self._items or (max_items is not None and removed >= max_items):
                    return removed
                head = self._items[0]
            try:
                result = send(head)
            except Exception as e:  # sender bugs must not lose the item
                log.error("outbox sender raised %s uid=%s", type(e).__name__, head.uid)
                result = SendResult.RETRY
            with self._lock:
                if not self._items or self._items[0].uid != head.uid:
                    continue
                if result is SendResult.RETRY:
                    head.attempts += 1
                    self._persist()
                    return removed
                if result is SendResult.DROP:
                    log.warning("outbox: server rejected kind=%s uid=%s meta=%s; dropped", head.kind, head.uid, head.meta)
                self._items.pop(0)
                self._persist()
                removed += 1
