"""Packed 1-bpp raster handling — Python port of ``packages/print-layout/src/raster.ts``.

Format ``packed-1bpp-msb``: 1 bit per dot, MSB first, ``1 = black``, each row
padded to ``bytesPerRow`` bytes. This maps 1:1 onto ESC/POS ``GS v 0``.

Raster bytes are customer content: never log them, never decode them into
anything but printer commands (or the mock printer's PBM files).
"""

from __future__ import annotations

import base64
import binascii
from dataclasses import dataclass, field
from typing import Any, Iterator, List, Mapping

RASTER_FORMAT = "packed-1bpp-msb"
#: Hard safety caps (a 58 mm slip is ~384 dots wide; 16000 rows ≈ 2 m of paper).
MAX_HEIGHT_DOTS = 16000
MAX_PAGES = 20
MAX_TOTAL_BYTES = 8 * 1024 * 1024
CUT_MODES = ("full", "partial", "none")


class RasterInvalid(ValueError):
    """Raised for any malformed raster. Messages never contain raster content."""


def fnv1a32(data: bytes) -> int:
    h = 0x811C9DC5
    for b in data:
        h ^= b
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def raster_digest(width_dots: int, height_dots: int, data: bytes) -> str:
    """Same as ``rasterDigest`` in raster.ts: ``{w}x{h}-{fnv1a32 hex}``."""
    return f"{width_dots}x{height_dots}-{fnv1a32(data):08x}"


@dataclass(frozen=True)
class RasterPage:
    width_dots: int
    height_dots: int
    bytes_per_row: int
    data: bytes = field(repr=False)  # repr=False: never leak content into logs/tracebacks

    def __post_init__(self) -> None:
        if not (isinstance(self.width_dots, int) and self.width_dots > 0):
            raise RasterInvalid("widthDots must be a positive integer")
        if not (isinstance(self.height_dots, int) and 0 < self.height_dots <= MAX_HEIGHT_DOTS):
            raise RasterInvalid("heightDots out of range")
        min_bpr = (self.width_dots + 7) // 8
        if not (isinstance(self.bytes_per_row, int) and min_bpr <= self.bytes_per_row <= 0xFFFF):
            raise RasterInvalid("bytesPerRow inconsistent with widthDots")
        if len(self.data) != self.bytes_per_row * self.height_dots:
            raise RasterInvalid("page data length != bytesPerRow * heightDots")

    @property
    def digest(self) -> str:
        return raster_digest(self.width_dots, self.height_dots, self.data)

    def ink_coverage(self) -> float:
        dots = sum(bin(b).count("1") for b in self.data)
        return dots / float(self.width_dots * self.height_dots)


@dataclass(frozen=True)
class JobRaster:
    pages: List[RasterPage]
    digest: str
    length_mm: float | None
    feed_before_cut_mm: float
    cut: str
    digest_verified: bool


def _decode_b64(value: Any) -> bytes:
    if not isinstance(value, str):
        raise RasterInvalid("page data must be a base64 string")
    try:
        return base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError):
        raise RasterInvalid("page data is not valid base64") from None


def parse_job_raster(raster: Any, max_width_dots: int) -> JobRaster:
    """Validate and decode the ``raster`` object of a leased job."""
    if not isinstance(raster, Mapping):
        raise RasterInvalid("raster must be an object")
    if raster.get("format") != RASTER_FORMAT:
        raise RasterInvalid("unsupported raster format")
    width = raster.get("widthDots")
    bpr = raster.get("bytesPerRow")
    if not isinstance(width, int) or not isinstance(bpr, int):
        raise RasterInvalid("widthDots/bytesPerRow must be integers")
    if bpr * 8 > max_width_dots:
        raise RasterInvalid("raster wider than printer")
    pages_raw = raster.get("pages")
    if not isinstance(pages_raw, list) or not (1 <= len(pages_raw) <= MAX_PAGES):
        raise RasterInvalid("pages must be a non-empty list")
    pages: List[RasterPage] = []
    total = 0
    for p in pages_raw:
        if not isinstance(p, Mapping):
            raise RasterInvalid("page must be an object")
        height = p.get("heightDots")
        if not isinstance(height, int):
            raise RasterInvalid("heightDots must be an integer")
        data = _decode_b64(p.get("data"))
        total += len(data)
        if total > MAX_TOTAL_BYTES:
            raise RasterInvalid("raster too large")
        pages.append(RasterPage(width, height, bpr, data))

    digest = raster.get("digest")
    if not isinstance(digest, str):
        raise RasterInvalid("digest missing")
    if len(pages) == 1:
        if pages[0].digest != digest:
            raise RasterInvalid("digest mismatch")
        verified = True
    else:
        # Multi-page digest definition is not pinned down in the protocol; we accept
        # a digest over the concatenated pages and otherwise only flag it as unverified.
        concat = b"".join(pg.data for pg in pages)
        verified = raster_digest(width, sum(pg.height_dots for pg in pages), concat) == digest

    feed = raster.get("feedBeforeCutMm", 0)
    if not isinstance(feed, (int, float)) or isinstance(feed, bool) or not (0 <= feed <= 100):
        raise RasterInvalid("feedBeforeCutMm out of range")
    cut = raster.get("cut", "full")
    if cut not in CUT_MODES:
        raise RasterInvalid("unknown cut mode")
    length = raster.get("lengthMm")
    length_mm = float(length) if isinstance(length, (int, float)) and not isinstance(length, bool) else None
    return JobRaster(pages, digest, length_mm, float(feed), cut, verified)


# --- ESC/POS GS v 0 -------------------------------------------------------------

ESC_INIT = b"\x1b\x40"


def gs_v0_header(bytes_per_row: int, rows: int, mode: int = 0) -> bytes:
    """``GS v 0 m xL xH yL yH`` — m=0 normal density."""
    return bytes(
        (0x1D, 0x76, 0x30, mode & 0xFF,
         bytes_per_row & 0xFF, (bytes_per_row >> 8) & 0xFF,
         rows & 0xFF, (rows >> 8) & 0xFF)
    )


def iter_gs_v0_bands(page: RasterPage, band_rows: int = 256) -> Iterator[bytes]:
    """Yield one ``GS v 0`` command per band (header + band rows)."""
    if not (1 <= band_rows <= 0xFFFF):
        raise ValueError("band_rows out of range")
    bpr = page.bytes_per_row
    view = memoryview(page.data)
    for y0 in range(0, page.height_dots, band_rows):
        rows = min(band_rows, page.height_dots - y0)
        yield gs_v0_header(bpr, rows) + bytes(view[y0 * bpr:(y0 + rows) * bpr])


def encode_gs_v0(page: RasterPage, band_rows: int = 256, include_init: bool = True) -> bytes:
    """Byte-for-byte equivalent of ``escposRaster`` in raster.ts (ESC @ + bands)."""
    out = bytearray(ESC_INIT if include_init else b"")
    for band in iter_gs_v0_bands(page, band_rows):
        out += band
    return bytes(out)


# --- local helpers ----------------------------------------------------------------

def to_pbm(page: RasterPage) -> bytes:
    """Binary PBM (P4). P4 uses the same MSB-first, 1=black packing."""
    row_bytes = (page.width_dots + 7) // 8
    header = f"P4\n# kvittel-mock {page.digest}\n{page.width_dots} {page.height_dots}\n".encode("ascii")
    if row_bytes == page.bytes_per_row:
        return header + page.data
    body = bytearray()
    for y in range(page.height_dots):
        start = y * page.bytes_per_row
        body += page.data[start:start + row_bytes]
    return header + bytes(body)


def test_pattern(width_dots: int = 384, height_dots: int = 240) -> RasterPage:
    """Content-free calibration pattern: border, diagonals, density ladder, alignment ticks."""
    bpr = (width_dots + 7) // 8
    buf = bytearray(bpr * height_dots)

    def dot(x: int, y: int) -> None:
        if 0 <= x < width_dots and 0 <= y < height_dots:
            buf[y * bpr + (x >> 3)] |= 0x80 >> (x & 7)

    for x in range(width_dots):
        for t in range(3):
            dot(x, t)
            dot(x, height_dots - 1 - t)
    for y in range(height_dots):
        for t in range(3):
            dot(t, y)
            dot(width_dots - 1 - t, y)
    for y in range(height_dots):  # two diagonals
        x = y * (width_dots - 1) // max(1, height_dots - 1)
        dot(x, y)
        dot(width_dots - 1 - x, y)
    band_top, band_h = height_dots // 3, max(8, height_dots // 6)
    steps = 6
    for s in range(steps):  # density ladder: 1/6 .. 6/6 dot density
        x0, x1 = 10 + s * (width_dots - 20) // steps, 10 + (s + 1) * (width_dots - 20) // steps
        for y in range(band_top, band_top + band_h):
            for x in range(x0, x1):
                if (x + y) % steps < s + 1:
                    dot(x, y)
    for x in range(0, width_dots, 8):  # 1 mm ticks at 8 dots/mm (203 dpi)
        for y in range(height_dots - 20, height_dots - (14 if x % 80 else 4)):
            dot(x, y)
    return RasterPage(width_dots, height_dots, bpr, bytes(buf))
