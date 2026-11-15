import base64
import tempfile
import unittest
from pathlib import Path
from typing import Dict, List

from fake_server import make_raster
from kvittel_agent.config import PrinterConfig
from kvittel_agent.printers.base import PrinterError
from kvittel_agent.printers.escpos import (
    EscPosRasterAdapter, dle_eot, feed_lines_command, mm_to_lines, parse_dle_eot,
)
from kvittel_agent.printers.mock import MockFaults, MockPrinterAdapter
from kvittel_agent.raster import (
    RasterInvalid, RasterPage, encode_gs_v0, fnv1a32, parse_job_raster, to_pbm,
)
from kvittel_agent.raster import test_pattern as make_test_pattern


class RasterTests(unittest.TestCase):
    def test_fnv1a32_vectors(self):
        self.assertEqual(fnv1a32(b""), 0x811C9DC5)
        self.assertEqual(fnv1a32(b"a"), 0xE40C292C)
        self.assertEqual(fnv1a32(b"foobar"), 0xBF9CF968)

    def test_gs_v0_byte_layout_single_band(self):
        page = RasterPage(16, 3, 2, bytes([0x80, 0x01, 0xFF, 0x00, 0x0F, 0xF0]))
        self.assertEqual(
            encode_gs_v0(page),
            b"\x1b\x40" + b"\x1d\x76\x30\x00" + b"\x02\x00" + b"\x03\x00" + bytes([0x80, 0x01, 0xFF, 0x00, 0x0F, 0xF0]),
        )

    def test_gs_v0_banding_and_little_endian_sizes(self):
        bpr, h = 300, 300  # bpr > 255 exercises xH
        data = bytes(i & 0xFF for i in range(bpr * h))
        out = encode_gs_v0(RasterPage(bpr * 8, h, bpr, data), band_rows=256)
        self.assertEqual(out[:2], b"\x1b\x40")
        self.assertEqual(out[2:10], bytes([0x1D, 0x76, 0x30, 0x00, 0x2C, 0x01, 0x00, 0x01]))  # 300, 256
        second = 10 + 256 * bpr
        self.assertEqual(out[10:second], data[:256 * bpr])
        self.assertEqual(out[second:second + 8], bytes([0x1D, 0x76, 0x30, 0x00, 0x2C, 0x01, 0x2C, 0x00]))  # 300, 44
        self.assertEqual(out[second + 8:], data[256 * bpr:])
        self.assertEqual(len(out), 2 + 2 * 8 + bpr * h)

    def test_page_validation(self):
        with self.assertRaises(RasterInvalid):
            RasterPage(384, 2, 48, b"\x00" * 95)
        with self.assertRaises(RasterInvalid):
            RasterPage(384, 1, 47, b"\x00" * 47)

    def test_repr_hides_content(self):
        self.assertNotIn("data", repr(RasterPage(8, 1, 1, b"\xaa")))

    def test_parse_job_raster(self):
        r = parse_job_raster(make_raster(), 384)
        self.assertEqual((len(r.pages), r.cut, r.feed_before_cut_mm, r.digest_verified), (1, "full", 12.0, True))
        bad = make_raster()
        bad["digest"] = "384x64-00000000"
        with self.assertRaises(RasterInvalid):
            parse_job_raster(bad, 384)
        wide = make_raster(width=576)
        with self.assertRaises(RasterInvalid):
            parse_job_raster(wide, 384)
        broken = make_raster()
        broken["pages"][0]["data"] = "!!notbase64!!"
        with self.assertRaises(RasterInvalid):
            parse_job_raster(broken, 384)
        self.assertTrue(parse_job_raster(make_raster(heights=(32, 40)), 384).digest_verified)

    def test_pbm(self):
        page = RasterPage(10, 2, 2, bytes([0xFF, 0xC0, 0x00, 0x40]))
        pbm = to_pbm(page)
        self.assertTrue(pbm.startswith(b"P4\n"))
        self.assertTrue(pbm.endswith(b"10 2\n" + bytes([0xFF, 0xC0, 0x00, 0x40])))

    def test_test_pattern_is_valid(self):
        p = make_test_pattern()
        self.assertEqual((p.width_dots, p.bytes_per_row), (384, 48))
        self.assertGreater(p.ink_coverage(), 0.0)


class FakeDevice:
    readable = True

    def __init__(self, responses: Dict[int, int] | None = None):
        self.writes: List[bytes] = []
        self.responses = responses or {}
        self._pending: List[int] = []

    def write(self, data: bytes) -> None:
        self.writes.append(bytes(data))
        if len(data) == 3 and data[:2] == b"\x10\x04" and data[2] in self.responses:
            self._pending.append(self.responses[data[2]])

    def read(self, n: int, timeout_s: float) -> bytes:
        return bytes([self._pending.pop(0)]) if self._pending else b""

    def close(self) -> None:
        pass

    @property
    def data(self) -> bytes:
        return b"".join(self.writes)


class EscPosTests(unittest.TestCase):
    def adapter(self, dev: FakeDevice, **cfg) -> EscPosRasterAdapter:
        pc = PrinterConfig(adapter="escpos", est_print_speed_mm_s=0, **cfg)
        return EscPosRasterAdapter(pc, device_factory=lambda: dev)

    def test_print_feed_cut_bytes(self):
        dev = FakeDevice()
        a = self.adapter(dev, write_chunk_bytes=100)
        page = RasterPage(384, 10, 48, bytes(range(240)) * 2)
        a.print_raster(page)
        self.assertEqual(dev.data, encode_gs_v0(page, 256))
        dev.writes.clear()
        a.feed(12)
        self.assertEqual(dev.data, feed_lines_command(3))  # ceil(12 / 4.23) = 3
        self.assertEqual(feed_lines_command(3), b"\x1b\x64\x03")
        dev.writes.clear()
        self.assertTrue(a.cut())
        self.assertEqual(dev.data, b"\x1d\x56\x00")

    def test_capabilities_default_unverified(self):
        caps = self.adapter(FakeDevice()).capabilities
        self.assertEqual(caps["raster"], "unverified")
        self.assertEqual(caps["cut"], "unverified")
        self.assertEqual(caps["realtimeStatus"], "unsupported")
        caps = self.adapter(FakeDevice(), status_query=True).capabilities
        self.assertEqual(caps["realtimeStatus"], "unverified")
        self.assertEqual(caps["cutterStatus"], "unverified")
        self.assertEqual(self.adapter(FakeDevice(), cut_command_hex="").capabilities["cut"], "unsupported")

    def test_no_cutter_configured(self):
        dev = FakeDevice()
        self.assertFalse(self.adapter(dev, cut_command_hex="").cut())
        self.assertEqual(dev.writes, [])

    def test_mm_to_lines(self):
        self.assertEqual(mm_to_lines(0, 4.23), 0)
        self.assertEqual(mm_to_lines(1, 4.23), 1)
        self.assertEqual(mm_to_lines(10000, 4.23), 255)

    def test_dle_eot_parsing(self):
        self.assertEqual(dle_eot(4), b"\x10\x04\x04")
        self.assertEqual(parse_dle_eot(4, 0x12), {"nearEnd": False, "paperEnd": False})
        self.assertEqual(parse_dle_eot(4, 0x7E), {"nearEnd": True, "paperEnd": True})
        self.assertTrue(parse_dle_eot(2, 0x16)["coverOpen"])
        self.assertTrue(parse_dle_eot(1, 0x1A)["offline"])
        self.assertTrue(parse_dle_eot(3, 0x1A)["autocutterError"])
        self.assertIsNone(parse_dle_eot(4, 0x00))  # fixed bits wrong → not trusted
        self.assertIsNone(parse_dle_eot(4, 0xFF))

    def test_status_query_decodes(self):
        dev = FakeDevice({1: 0x12, 2: 0x12, 3: 0x12, 4: 0x1E})  # near end
        st = self.adapter(dev, status_query=True).status()
        self.assertEqual((st.online, st.paper, st.cover, st.cutter), (True, "near_end", "closed", "ok"))

    def test_status_no_response_is_unknown(self):
        st = self.adapter(FakeDevice(), status_query=True).status()
        self.assertEqual(st.paper, "unknown")

    def test_verified_status_blocks_print_on_paper_end(self):
        dev = FakeDevice({1: 0x12, 2: 0x32, 3: 0x12, 4: 0x72})
        a = self.adapter(dev, status_query=True, status_verified=True)
        with self.assertRaises(PrinterError) as cm:
            a.print_raster(RasterPage(384, 1, 48, b"\x00" * 48))
        self.assertEqual((cm.exception.code, cm.exception.bytes_sent), ("paper_end", False))
        self.assertTrue(all(w[:2] == b"\x10\x04" for w in dev.writes))  # only status queries sent

    def test_unverified_status_does_not_block(self):
        dev = FakeDevice({4: 0x72})
        self.adapter(dev, status_query=True).print_raster(RasterPage(384, 1, 48, b"\x00" * 48))
        self.assertIn(b"\x1d\x76\x30\x00", dev.data)

    def test_device_missing_is_offline(self):
        def factory():
            raise FileNotFoundError("/dev/usb/lp0")

        a = EscPosRasterAdapter(PrinterConfig(est_print_speed_mm_s=0), device_factory=factory)
        self.assertIs(a.status().online, False)
        with self.assertRaises(PrinterError) as cm:
            a.print_raster(RasterPage(384, 1, 48, b"\x00" * 48))
        self.assertEqual((cm.exception.code, cm.exception.bytes_sent), ("printer_offline", False))

    def test_write_failure_mid_job(self):
        class Flaky(FakeDevice):
            def write(self, data):
                if len(self.writes) >= 1:
                    raise OSError("EIO")
                super().write(data)

        a = self.adapter(Flaky())
        with self.assertRaises(PrinterError) as cm:
            a.print_raster(RasterPage(384, 2, 48, b"\x00" * 96))
        self.assertEqual((cm.exception.code, cm.exception.bytes_sent), ("printer_offline", True))


class MockPrinterTests(unittest.TestCase):
    def test_writes_pbm_and_faults(self):
        with tempfile.TemporaryDirectory() as d:
            m = MockPrinterAdapter(Path(d))
            page = RasterPage(16, 2, 2, b"\xff\x00\x00\xff")
            m.print_raster(page)
            files = list(Path(d).glob("*.pbm"))
            self.assertEqual(len(files), 1)
            self.assertIn(page.digest, files[0].name)
            m.faults = MockFaults(paper_end=True)
            with self.assertRaises(PrinterError) as cm:
                m.print_raster(page)
            self.assertEqual(cm.exception.code, "paper_end")
            self.assertEqual(m.status().paper, "paper_end")


if __name__ == "__main__":
    unittest.main()
