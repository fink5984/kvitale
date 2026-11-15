"""Host telemetry from /proc and /sys. Missing data is reported as None/"unknown" — never invented."""

from __future__ import annotations

import hashlib
import os
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from .fsutil import atomic_write_bytes

RTF_UP = 0x0001


def _read(path: Path) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None


class TelemetryCollector:
    def __init__(self, proc_root: str = "/proc", sys_root: str = "/sys") -> None:
        self.proc = Path(proc_root)
        self.sys = Path(sys_root)

    def default_route_iface(self) -> Optional[str]:
        text = _read(self.proc / "net" / "route")
        if not text:
            return None
        best: Optional[tuple[int, str]] = None
        for line in text.splitlines()[1:]:
            parts = line.split()
            if len(parts) < 7:
                continue
            iface, dest, flags, metric = parts[0], parts[1], parts[3], parts[6]
            try:
                if dest != "00000000" or not (int(flags, 16) & RTF_UP):
                    continue
                m = int(metric)
            except ValueError:
                continue
            if best is None or m < best[0]:
                best = (m, iface)
        return best[1] if best else None

    def network_type(self) -> str:
        iface = self.default_route_iface()
        if not iface:
            return "unknown"
        if (self.sys / "class" / "net" / iface / "wireless").exists() or iface.startswith("wl"):
            return "wifi"
        if iface.startswith(("eth", "en")):
            return "ethernet"
        if iface.startswith(("wwan", "ppp", "rmnet")):
            return "lte"
        return "unknown"

    def wifi_signal_dbm(self) -> Optional[int]:
        text = _read(self.proc / "net" / "wireless")
        if not text:
            return None
        wanted = self.default_route_iface()
        for line in text.splitlines()[2:]:
            if ":" not in line:
                continue
            name, rest = line.split(":", 1)
            if wanted and name.strip() != wanted:
                continue
            parts = rest.split()
            if len(parts) < 3:
                continue
            try:
                level = float(parts[2].rstrip("."))
            except ValueError:
                continue
            # Only accept plausible dBm values; some drivers report a 0..100 quality scale here.
            if -120 <= level < 0:
                return int(level)
            return None
        return None

    def uptime_s(self) -> Optional[int]:
        text = _read(self.proc / "uptime")
        try:
            return int(float(text.split()[0])) if text else None
        except (ValueError, IndexError):
            return None

    def temp_c(self) -> Optional[float]:
        text = _read(self.sys / "class" / "thermal" / "thermal_zone0" / "temp")
        try:
            return round(int(text.strip()) / 1000.0, 1) if text else None
        except ValueError:
            return None

    def collect(self) -> Dict[str, Any]:
        net = self.network_type()
        return {
            "network": net,
            "signalDbm": self.wifi_signal_dbm() if net == "wifi" else None,
            "tempC": self.temp_c(),
            "uptimeS": self.uptime_s(),
        }


def hardware_id(proc_root: str = "/proc", etc_root: str = "/etc", fallback_file: Optional[Path] = None) -> str:
    """Stable hardware id: Pi CPU serial, else hashed machine-id, else a persisted random id."""
    cpuinfo = _read(Path(proc_root) / "cpuinfo") or ""
    for line in cpuinfo.splitlines():
        if line.lower().startswith("serial"):
            serial = line.split(":", 1)[-1].strip()
            if serial and set(serial) != {"0"}:
                return f"rpi-serial-{serial}"
    mid = (_read(Path(etc_root) / "machine-id") or "").strip()
    if mid:
        return "machine-" + hashlib.sha256(mid.encode()).hexdigest()[:16]
    if fallback_file is not None:
        existing = (_read(fallback_file) or "").strip()
        if existing:
            return existing
        new = f"random-{uuid.uuid4()}"
        atomic_write_bytes(fallback_file, new.encode(), 0o600)
        return new
    return "unknown"
