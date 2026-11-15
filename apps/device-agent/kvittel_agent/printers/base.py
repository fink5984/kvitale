"""Printer adapter interface.

Capability values:

* ``"supported"``   — verified to work on this unit (operator-confirmed, or the mock).
* ``"unsupported"`` — not available / not configured.
* ``"unverified"``  — implemented generically but NOT validated on the real model.
  Unverified readings are shown in diagnostics but never acted upon and are
  reported to the server as ``"unsupported"``.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, Literal, Optional

from ..raster import RasterPage

Capability = Literal["supported", "unsupported", "unverified"]
CAPABILITY_KEYS = (
    "raster",          # GS v 0 raster printing
    "feed",
    "cut",             # cutter command issued
    "cutterStatus",    # can detect cutter fault
    "nearEnd",
    "paperEnd",
    "coverOpen",
    "realtimeStatus",  # DLE EOT style status queries
    "online",          # can tell whether the printer is reachable
)

PRINTER_ERRORS = ("paper_end", "cover_open", "cutter_jam", "printer_offline", "raster_invalid", "other")


class PrinterError(Exception):
    """``code`` ∈ PRINTER_ERRORS. ``bytes_sent`` tells whether any job byte reached the device."""

    def __init__(self, code: str, bytes_sent: bool = False, detail: str = "") -> None:
        if code not in PRINTER_ERRORS:
            code = "other"
        super().__init__(code + (f" ({detail})" if detail else ""))
        self.code = code
        self.bytes_sent = bytes_sent
        self.detail = detail


@dataclass
class PrinterStatus:
    online: Optional[bool] = None                 # None = unknown
    paper: str = "unknown"                        # ok | near_end | paper_end | unknown | unsupported
    cover: str = "unknown"                        # closed | open | unknown | unsupported
    cutter: str = "unknown"                       # ok | fault | unknown | unsupported
    raw: Dict[str, Any] = field(default_factory=dict)  # decoded status bits (no content)

    def blocking_error(self) -> Optional[str]:
        if self.online is False:
            return "printer_offline"
        if self.paper == "paper_end":
            return "paper_end"
        if self.cover == "open":
            return "cover_open"
        if self.cutter == "fault":
            return "cutter_jam"
        return None

    def as_dict(self) -> Dict[str, Any]:
        return {"online": self.online, "paper": self.paper, "cover": self.cover, "cutter": self.cutter, "raw": self.raw}


class PrinterAdapter(ABC):
    name: str = "abstract"

    @property
    @abstractmethod
    def capabilities(self) -> Dict[str, Capability]:
        """All of CAPABILITY_KEYS mapped to a Capability value."""

    @abstractmethod
    def status(self) -> PrinterStatus:
        """Best-effort status. Must not raise; unknown fields stay "unknown"/"unsupported"."""

    @abstractmethod
    def print_raster(self, page: RasterPage) -> None:
        """Print one page. Raises PrinterError (with bytes_sent) on failure."""

    @abstractmethod
    def feed(self, mm: float) -> None:
        """Advance paper by approximately ``mm``."""

    @abstractmethod
    def cut(self, mode: str = "full") -> bool:
        """Issue a cut. Returns False if no cutter is configured. Raises PrinterError on I/O failure."""

    def begin_job(self) -> None:
        """Called once before the first page of a job. Default no-op."""

    def close(self) -> None:  # pragma: no cover - default no-op
        pass

    def capability(self, key: str) -> Capability:
        return self.capabilities.get(key, "unsupported")

    def trusted(self, key: str) -> bool:
        return self.capability(key) == "supported"
