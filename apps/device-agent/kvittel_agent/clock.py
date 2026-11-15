"""Wall clock with server-time drift correction.

Every server response carries ``serverTime``. We estimate the offset between
the server clock and the local clock using the request midpoint and smooth it,
so command expiry and event timestamps are correct even on a Pi without RTC
whose NTP sync has not happened yet.
"""

from __future__ import annotations

import re
import threading
import time
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

_ISO_RE = re.compile(
    r"^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?"
    r"(Z|[+-]\d{2}:?\d{2})?$"
)


def parse_iso(value: str) -> datetime:
    """Parse an ISO-8601 timestamp (``Z`` or offset; naive treated as UTC)."""
    if not isinstance(value, str):
        raise ValueError("timestamp must be a string")
    m = _ISO_RE.match(value.strip())
    if not m:
        raise ValueError("invalid ISO-8601 timestamp")
    year, month, day, hh, mm, ss, frac, tz = m.groups()
    micro = int((frac or "0").ljust(6, "0")[:6])
    if tz in (None, "Z"):
        tzinfo = timezone.utc
    else:
        sign = 1 if tz[0] == "+" else -1
        digits = tz[1:].replace(":", "")
        tzinfo = timezone(sign * timedelta(hours=int(digits[:2]), minutes=int(digits[2:])))
    return datetime(int(year), int(month), int(day), int(hh), int(mm), int(ss), micro, tzinfo=tzinfo)


def format_iso(dt: datetime) -> str:
    dt = dt.astimezone(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


class Clock:
    """Drift-corrected UTC clock. Thread-safe."""

    #: Offsets that jump by more than this are applied immediately instead of smoothed.
    JUMP_S = 120.0
    ALPHA = 0.3

    def __init__(
        self,
        wall: Callable[[], float] = time.time,
        mono: Callable[[], float] = time.monotonic,
    ) -> None:
        self._wall = wall
        self._mono = mono
        self._offset = 0.0
        self._synced = False
        self._lock = threading.Lock()

    def wall(self) -> float:
        return self._wall()

    def monotonic(self) -> float:
        return self._mono()

    @property
    def offset_s(self) -> float:
        return self._offset

    @property
    def synced(self) -> bool:
        return self._synced

    def now_ts(self) -> float:
        return self._wall() + self._offset

    def now(self) -> datetime:
        return datetime.fromtimestamp(self.now_ts(), tz=timezone.utc)

    def iso_now(self) -> str:
        return format_iso(self.now())

    def observe_server_time(self, server_time: str, sent_wall: float, recv_wall: float) -> Optional[float]:
        """Update the offset from a response's ``serverTime``. Returns the new offset or None."""
        try:
            server_ts = parse_iso(server_time).timestamp()
        except ValueError:
            return None
        midpoint = (sent_wall + recv_wall) / 2.0
        sample = server_ts - midpoint
        with self._lock:
            if not self._synced or abs(sample - self._offset) > self.JUMP_S:
                self._offset = sample
            else:
                self._offset = (1 - self.ALPHA) * self._offset + self.ALPHA * sample
            self._synced = True
            return self._offset
