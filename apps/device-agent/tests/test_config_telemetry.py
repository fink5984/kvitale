import json
import logging
import tempfile
import unittest
from pathlib import Path

from kvittel_agent.clock import Clock, format_iso, parse_iso
from kvittel_agent.config import ConfigError, load_config, parse_toml_subset
from kvittel_agent.logutil import SafetyFilter
from kvittel_agent.telemetry import TelemetryCollector, hardware_id
from kvittel_agent.transport import Backoff

HERE = Path(__file__).resolve().parent
EXAMPLE = HERE.parent / "config.example.toml"


class ConfigTests(unittest.TestCase):
    def test_example_config_loads(self):
        cfg = load_config(EXAMPLE, env={})
        self.assertTrue(cfg.server_url.startswith("https://"))
        self.assertEqual(cfg.outbox_max, 500)
        self.assertEqual(cfg.hooks.reboot_agent, "disabled")

    def test_subset_parser_matches_tomllib_when_available(self):
        text = EXAMPLE.read_text(encoding="utf-8")
        try:
            import tomllib  # type: ignore[import-not-found]
        except ModuleNotFoundError:
            self.skipTest("tomllib not available (Python 3.10)")
        self.assertEqual(parse_toml_subset(text), tomllib.loads(text))

    def test_subset_parser(self):
        d = parse_toml_subset(
            'a = "x # not a comment" # comment\nb = 1_000\nc = 2.5\nd = true\n'
            "e = ['/usr/bin/systemctl', \"reboot\"]\n[t.u]\nk = -3\n"
        )
        self.assertEqual(d, {"a": "x # not a comment", "b": 1000, "c": 2.5, "d": True,
                             "e": ["/usr/bin/systemctl", "reboot"], "t": {"u": {"k": -3}}})
        for bad in ("a = \n", "a = 1\na = 2\n", "[[x]]\n", 'a = """x"""\n', "a = [1,\n"):
            with self.assertRaises(ConfigError):
                parse_toml_subset(bad)

    def test_env_overrides_and_validation(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "c.json"
            p.write_text(json.dumps({"server_url": "https://a.example", "printer": {"adapter": "mock"}}))
            cfg = load_config(p, env={"KVITTEL_SERVER": "http://localhost:3000", "KVITTEL_PRINTER_ADAPTER": "escpos",
                                      "KVITTEL_PRINTER_DEVICE": "/dev/kvittel-printer"})
            self.assertEqual(cfg.server_url, "http://localhost:3000")
            self.assertEqual((cfg.printer.adapter, cfg.printer.device), ("escpos", "/dev/kvittel-printer"))
            with self.assertRaises(ConfigError):
                load_config(p, env={"KVITTEL_SERVER": "http://evil.example"})  # plain http to non-localhost
            p.write_text(json.dumps({"bogus": 1}))
            with self.assertRaises(ConfigError):
                load_config(p, env={})
            p.write_text(json.dumps({"hooks": {"reboot_agent": ["systemctl", "reboot"]}}))
            with self.assertRaises(ConfigError):
                load_config(p, env={})  # relative argv[0]
            with self.assertRaises(ConfigError):
                load_config(Path(d) / "missing.toml", env={})


class TelemetryTests(unittest.TestCase):
    def test_reads_proc_and_sys(self):
        with tempfile.TemporaryDirectory() as d:
            proc, sys_ = Path(d) / "proc", Path(d) / "sys"
            (proc / "net").mkdir(parents=True)
            (proc / "net" / "route").write_text(
                "Iface\tDestination\tGateway\tFlags\tRefCnt\tUse\tMetric\tMask\n"
                "eth0\t00000000\t0101A8C0\t0003\t0\t0\t202\t00000000\n"
                "wlan0\t00000000\t0101A8C0\t0003\t0\t0\t100\t00000000\n"
            )
            (proc / "net" / "wireless").write_text(
                "Inter-| sta-|   Quality        |   Discarded packets\n"
                " face | tus | link level noise |  nwid  crypt   frag\n"
                " wlan0: 0000   54.  -61.  -256        0      0      0      0      0        0\n"
            )
            (proc / "uptime").write_text("86400.55 1000.00\n")
            (sys_ / "class" / "thermal" / "thermal_zone0").mkdir(parents=True)
            (sys_ / "class" / "thermal" / "thermal_zone0" / "temp").write_text("47236\n")
            t = TelemetryCollector(str(proc), str(sys_)).collect()
            self.assertEqual(t, {"network": "wifi", "signalDbm": -61, "tempC": 47.2, "uptimeS": 86400})

    def test_missing_sources_are_unknown_not_fabricated(self):
        with tempfile.TemporaryDirectory() as d:
            t = TelemetryCollector(str(Path(d) / "p"), str(Path(d) / "s")).collect()
            self.assertEqual(t, {"network": "unknown", "signalDbm": None, "tempC": None, "uptimeS": None})

    def test_hardware_id(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "cpuinfo").write_text("Hardware\t: BCM2835\nSerial\t\t: 00000000abcdef12\n")
            self.assertEqual(hardware_id(d, d), "rpi-serial-00000000abcdef12")
            fb = Path(d) / "hwid"
            first = hardware_id(str(Path(d) / "none"), str(Path(d) / "none"), fb)
            self.assertEqual(first, hardware_id(str(Path(d) / "none"), str(Path(d) / "none"), fb))


class ClockBackoffLogTests(unittest.TestCase):
    def test_iso_roundtrip(self):
        dt = parse_iso("2026-11-13T10:00:00.123456789Z")
        self.assertEqual(format_iso(dt), "2026-11-13T10:00:00.123Z")
        self.assertEqual(parse_iso("2026-11-13T12:00:00+02:00"), parse_iso("2026-11-13T10:00:00Z"))

    def test_drift_correction(self):
        c = Clock(wall=lambda: 1000.0)
        c.observe_server_time("1970-01-01T00:20:00Z", 999.0, 1001.0)  # server = 1200
        self.assertAlmostEqual(c.offset_s, 200.0)
        self.assertAlmostEqual(c.now_ts(), 1200.0)

    def test_backoff_bounds(self):
        lo, hi = Backoff(1, 60, rng=lambda: 0.0), Backoff(1, 60, rng=lambda: 0.999999)
        self.assertAlmostEqual(lo.delay(0), 0.5)
        self.assertLessEqual(hi.delay(0), 1.0)
        self.assertLessEqual(hi.delay(50), 60.0)
        self.assertGreaterEqual(lo.delay(50), 30.0)

    def test_log_safety_filter_redacts(self):
        rec = logging.LogRecord("x", logging.INFO, __file__, 1, "tok=%s blob=%s", ("kvd_abcDEF123", "A" * 500), None)
        SafetyFilter().filter(rec)
        msg = rec.getMessage()
        self.assertNotIn("kvd_abcDEF123", msg)
        self.assertNotIn("A" * 200, msg)


if __name__ == "__main__":
    unittest.main()
