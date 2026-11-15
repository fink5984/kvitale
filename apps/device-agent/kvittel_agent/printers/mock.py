"""Mock printer: writes each printed page as a binary PBM (P4) file, with fault injection.

The PBM files contain the printed slip (that is the point of the mock), so the
output folder must be treated like customer content: it lives under the spool
directory (0700) and is for development / bench testing only.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..fsutil import atomic_write_bytes
from ..raster import RasterPage, to_pbm
from .base import CAPABILITY_KEYS, Capability, PrinterAdapter, PrinterError, PrinterStatus


@dataclass
class MockFaults:
    offline: bool = False
    paper_end: bool = False
    near_end: bool = False
    cover_open: bool = False
    cutter_fault: bool = False            # status reports cutter fault
    cutter_jam_on_cut: bool = False       # cut() raises cutter_jam
    fail_during_print: Optional[str] = None  # error code raised after some bytes were sent
    fail_on_page: int = 0                 # which page index fail_during_print applies to


@dataclass
class MockPrinterAdapter(PrinterAdapter):
    output_dir: Path
    faults: MockFaults = field(default_factory=MockFaults)
    caps: Dict[str, Capability] = field(default_factory=lambda: {k: "supported" for k in CAPABILITY_KEYS})
    operations: List[Tuple[Any, ...]] = field(default_factory=list)
    name: str = "mock"

    def __post_init__(self) -> None:
        self.output_dir = Path(self.output_dir)
        self._seq = 0
        self._page_in_job = 0
        self._lock = threading.Lock()

    @property
    def capabilities(self) -> Dict[str, Capability]:
        return dict(self.caps)

    def status(self) -> PrinterStatus:
        f = self.faults
        if f.offline:
            return PrinterStatus(online=False, paper="unknown", cover="unknown", cutter="unknown")
        paper = "paper_end" if f.paper_end else ("near_end" if f.near_end else "ok")
        return PrinterStatus(
            online=True,
            paper=paper,
            cover="open" if f.cover_open else "closed",
            cutter="fault" if f.cutter_fault else "ok",
        )

    def print_raster(self, page: RasterPage) -> None:
        f = self.faults
        if f.offline:
            raise PrinterError("printer_offline", bytes_sent=False)
        if f.paper_end:
            raise PrinterError("paper_end", bytes_sent=False)
        if f.cover_open:
            raise PrinterError("cover_open", bytes_sent=False)
        with self._lock:
            page_index = self._page_in_job
            self._page_in_job += 1
            if f.fail_during_print and page_index == f.fail_on_page:
                self.operations.append(("print_partial", page.digest))
                raise PrinterError(f.fail_during_print, bytes_sent=True)
            self._seq += 1
            out = self.output_dir / f"page-{self._seq:05d}-{page.digest}.pbm"
            atomic_write_bytes(out, to_pbm(page), 0o600)
            self.operations.append(("print", page.digest, out.name))

    def feed(self, mm: float) -> None:
        if self.faults.offline:
            raise PrinterError("printer_offline", bytes_sent=True)
        self.operations.append(("feed", float(mm)))

    def cut(self, mode: str = "full") -> bool:
        if self.caps.get("cut") == "unsupported":
            return False
        if self.faults.cutter_jam_on_cut:
            raise PrinterError("cutter_jam", bytes_sent=True)
        self.operations.append(("cut", mode))
        return True

    def begin_job(self) -> None:
        self._page_in_job = 0  # page index used by fail_on_page

    @property
    def printed_pages(self) -> List[str]:
        return [op[1] for op in self.operations if op[0] == "print"]
