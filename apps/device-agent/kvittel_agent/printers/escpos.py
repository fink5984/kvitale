"""Generic ESC/POS raster adapter over a character device or a serial port.

What is implemented (generic ESC/POS, *not validated on any specific model*):

* ``ESC @`` + ``GS v 0`` raster, sent in bands (default 256 rows) so small
  printer buffers are not overrun.
* ``ESC d n`` feed (``n`` lines; mm→lines uses ``line_feed_mm``, UNVERIFIED).
* Cut: configurable raw bytes (default ``GS V 0`` = 1D 56 00). UNVERIFIED —
  58 mm printers differ (GS V 0/1, GS V 65/66 n, ESC i, ESC m) and some have no
  cutter at all. Sending the bytes does NOT prove a cut happened.
* Real-time status ``DLE EOT n`` (n = 1..4) decoded per the common Epson bit
  layout. UNVERIFIED — many clones answer only some ``n``, answer with other
  bits, or not at all. Also note: on some printers real-time commands are
  interpreted even inside raster data; we only query between jobs.

Capabilities therefore default to ``"unverified"`` until the operator sets the
``*_verified`` flags after running the checklist in docs/HARDWARE_BOM.md.
"""

from __future__ import annotations

import logging
import math
import os
import time
from typing import Callable, Dict, Optional, Protocol

from ..config import PrinterConfig
from ..raster import ESC_INIT, RasterPage, iter_gs_v0_bands
from .base import Capability, PrinterAdapter, PrinterError, PrinterStatus

log = logging.getLogger("kvittel.printer.escpos")

DLE, EOT = 0x10, 0x04
STATUS_PRINTER, STATUS_OFFLINE, STATUS_ERROR, STATUS_PAPER = 1, 2, 3, 4


# --- raw devices ----------------------------------------------------------------------

class RawDevice(Protocol):
    readable: bool

    def write(self, data: bytes) -> None: ...
    def read(self, n: int, timeout_s: float) -> bytes: ...
    def close(self) -> None: ...


class FileRawDevice:
    """Character device such as ``/dev/usb/lp0`` (usblp) or a udev symlink to it."""

    def __init__(self, path: str) -> None:
        noctty = getattr(os, "O_NOCTTY", 0)
        binary = getattr(os, "O_BINARY", 0)
        try:
            self._fd = os.open(path, os.O_RDWR | noctty | binary)
            self.readable = os.name == "posix"
        except OSError:
            self._fd = os.open(path, os.O_WRONLY | noctty | binary)
            self.readable = False

    def write(self, data: bytes) -> None:
        view = memoryview(data)
        while view:
            n = os.write(self._fd, view)
            if n <= 0:
                raise OSError("short write")
            view = view[n:]

    def read(self, n: int, timeout_s: float) -> bytes:
        if not self.readable:
            return b""
        import select

        r, _, _ = select.select([self._fd], [], [], timeout_s)
        if not r:
            return b""
        return os.read(self._fd, n)

    def close(self) -> None:
        try:
            os.close(self._fd)
        except OSError:
            pass


class SerialRawDevice:
    """Serial printer via optional ``pyserial``. XON/XOFF is never used (raster bytes contain 0x11/0x13)."""

    def __init__(self, path: str, baud: int, rtscts: bool) -> None:
        try:
            import serial  # type: ignore[import-not-found]
        except ImportError:
            raise PrinterError("printer_offline", detail="pyserial not installed") from None
        self._s = serial.Serial(path, baudrate=baud, timeout=0, write_timeout=30, rtscts=rtscts, xonxoff=False)
        self.readable = True

    def write(self, data: bytes) -> None:
        self._s.write(data)
        self._s.flush()

    def read(self, n: int, timeout_s: float) -> bytes:
        self._s.timeout = timeout_s
        return bytes(self._s.read(n))

    def close(self) -> None:
        try:
            self._s.close()
        except Exception:
            pass


# --- command helpers ------------------------------------------------------------------

def parse_hex_command(hex_str: str) -> bytes:
    return bytes.fromhex(hex_str.replace(" ", "")) if hex_str.strip() else b""


def feed_lines_command(lines: int) -> bytes:
    """``ESC d n`` — print and feed ``n`` lines (0..255)."""
    return bytes((0x1B, 0x64, max(0, min(255, int(lines)))))


def mm_to_lines(mm: float, line_mm: float) -> int:
    if mm <= 0:
        return 0
    return min(255, max(1, math.ceil(mm / line_mm)))


def dle_eot(n: int) -> bytes:
    return bytes((DLE, EOT, n))


def _fixed_bits_ok(b: int) -> bool:
    # Epson layout: bit0 = 0, bit1 = 1, bit4 = 1, bit7 = 0 in every DLE EOT response.
    return (b & 0x93) == 0x12


def parse_dle_eot(n: int, b: int) -> Optional[Dict[str, bool]]:
    """Decode one DLE EOT response byte (common Epson layout). None if the byte doesn't fit the layout."""
    if not (0 <= b <= 0xFF) or not _fixed_bits_ok(b):
        return None
    if n == STATUS_PRINTER:
        return {"offline": bool(b & 0x08), "waitingOnlineRecovery": bool(b & 0x20), "feedButton": bool(b & 0x40)}
    if n == STATUS_OFFLINE:
        return {"coverOpen": bool(b & 0x04), "feedingByButton": bool(b & 0x08),
                "paperEndStop": bool(b & 0x20), "errorOccurred": bool(b & 0x40)}
    if n == STATUS_ERROR:
        return {"autocutterError": bool(b & 0x08), "unrecoverableError": bool(b & 0x20),
                "autoRecoverableError": bool(b & 0x40)}
    if n == STATUS_PAPER:
        return {"nearEnd": bool(b & 0x0C), "paperEnd": bool(b & 0x60)}
    return None


def status_from_bits(bits: Dict[int, Optional[Dict[str, bool]]]) -> PrinterStatus:
    st = PrinterStatus(online=True, paper="unknown", cover="unknown", cutter="unknown")
    p1, p2, p3, p4 = (bits.get(i) for i in (1, 2, 3, 4))
    if p1 is not None:
        st.online = not p1["offline"]
    if p2 is not None:
        st.cover = "open" if p2["coverOpen"] else "closed"
    if p3 is not None:
        st.cutter = "fault" if p3["autocutterError"] else "ok"
    if p4 is not None:
        st.paper = "paper_end" if p4["paperEnd"] else ("near_end" if p4["nearEnd"] else "ok")
    elif p2 is not None and p2["paperEndStop"]:
        st.paper = "paper_end"
    st.raw = {str(k): v for k, v in bits.items()}
    return st


# --- adapter --------------------------------------------------------------------------

class EscPosRasterAdapter(PrinterAdapter):
    name = "escpos"

    def __init__(
        self,
        cfg: PrinterConfig,
        device_factory: Optional[Callable[[], RawDevice]] = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self.cfg = cfg
        self._factory = device_factory or self._default_factory
        self._dev: Optional[RawDevice] = None
        self._sleep = sleep
        self._cut = parse_hex_command(cfg.cut_command_hex)
        self._partial_cut = parse_hex_command(cfg.partial_cut_command_hex) or self._cut

    def _default_factory(self) -> RawDevice:
        if self.cfg.connection == "serial":
            return SerialRawDevice(self.cfg.device, self.cfg.serial_baud, self.cfg.serial_flow_control == "rtscts")
        return FileRawDevice(self.cfg.device)

    # -- capabilities ----------------------------------------------------------------
    @property
    def capabilities(self) -> Dict[str, Capability]:
        c = self.cfg

        def level(enabled: bool, verified: bool) -> Capability:
            if not enabled:
                return "unsupported"
            return "supported" if verified else "unverified"

        rt = level(c.status_query, c.status_verified)
        return {
            "raster": "supported" if c.raster_verified else "unverified",
            "feed": "supported" if c.raster_verified else "unverified",
            "cut": level(bool(self._cut), c.cut_verified),
            "cutterStatus": rt,
            "nearEnd": rt,
            "paperEnd": rt,
            "coverOpen": rt,
            "realtimeStatus": rt,
            "online": "supported",  # can we open/write the device node
        }

    # -- device handling ---------------------------------------------------------------
    def _device(self) -> RawDevice:
        if self._dev is None:
            try:
                self._dev = self._factory()
            except PrinterError:
                raise
            except OSError as e:
                raise PrinterError("printer_offline", bytes_sent=False, detail=type(e).__name__) from None
        return self._dev

    def _drop_device(self) -> None:
        if self._dev is not None:
            self._dev.close()
            self._dev = None

    def _write(self, data: bytes) -> None:
        dev = self._device()
        try:
            chunk = max(64, self.cfg.write_chunk_bytes)
            for i in range(0, len(data), chunk):
                dev.write(data[i:i + chunk])
        except OSError as e:
            self._drop_device()
            raise PrinterError("printer_offline", bytes_sent=True, detail=type(e).__name__) from None

    def close(self) -> None:
        self._drop_device()

    # -- status --------------------------------------------------------------------------
    def query_status(self) -> PrinterStatus:
        dev = self._device()
        bits: Dict[int, Optional[Dict[str, bool]]] = {}
        timeout = self.cfg.status_timeout_ms / 1000.0
        for n in (STATUS_PRINTER, STATUS_OFFLINE, STATUS_ERROR, STATUS_PAPER):
            try:
                dev.write(dle_eot(n))
                resp = dev.read(1, timeout)
            except OSError:
                self._drop_device()
                return PrinterStatus(online=False)
            bits[n] = parse_dle_eot(n, resp[0]) if resp else None
        if all(v is None for v in bits.values()):
            return PrinterStatus(online=True, raw={"note": "no_status_response"})
        return status_from_bits(bits)

    def status(self) -> PrinterStatus:
        unsupported = "unsupported"
        try:
            dev = self._device()
        except PrinterError:
            return PrinterStatus(online=False, paper="unknown", cover="unknown", cutter="unknown")
        if not self.cfg.status_query or not getattr(dev, "readable", False):
            return PrinterStatus(online=True, paper=unsupported, cover=unsupported, cutter=unsupported)
        return self.query_status()

    # -- printing --------------------------------------------------------------------------
    def print_raster(self, page: RasterPage) -> None:
        if page.bytes_per_row * 8 > self.cfg.width_dots:
            raise PrinterError("raster_invalid", bytes_sent=False, detail="wider than printer")
        self._device()  # raises printer_offline (bytes_sent=False) if absent
        if self.trusted("realtimeStatus"):
            err = self.query_status().blocking_error()
            if err:
                raise PrinterError(err, bytes_sent=False)
        sent = False
        try:
            self._write(ESC_INIT)
            sent = True
            for band in iter_gs_v0_bands(page, self.cfg.band_rows):
                self._write(band)
        except PrinterError as e:
            raise PrinterError(e.code, bytes_sent=sent or e.bytes_sent, detail=e.detail) from None
        # write() returning means the kernel/printer buffer accepted the bytes, not that
        # the head finished. Optionally wait the estimated print time (UNVERIFIED speed).
        if self.cfg.est_print_speed_mm_s > 0:
            mm = page.height_dots / max(1.0, self.cfg.dots_per_mm)
            self._sleep(mm / self.cfg.est_print_speed_mm_s)

    def feed(self, mm: float) -> None:
        lines = mm_to_lines(mm, self.cfg.line_feed_mm)
        if lines:
            self._write(feed_lines_command(lines))

    def cut(self, mode: str = "full") -> bool:
        cmd = self._partial_cut if mode == "partial" else self._cut
        if not cmd:
            return False
        try:
            self._write(cmd)
        except PrinterError as e:
            raise PrinterError("cutter_jam" if e.code == "other" else e.code, bytes_sent=True) from None
        return True
