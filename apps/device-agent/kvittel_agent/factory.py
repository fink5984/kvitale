"""Build hardware adapters from config."""

from __future__ import annotations

from pathlib import Path

from .config import AgentConfig
from .printers.base import PrinterAdapter
from .sensors import ChuteSensor, GpioChuteSensor, MockChuteSensor, MockPowerMonitor, NullChuteSensor, NullPowerMonitor, PowerMonitor


def build_printer(cfg: AgentConfig) -> PrinterAdapter:
    if cfg.printer.adapter == "escpos":
        from .printers.escpos import EscPosRasterAdapter

        return EscPosRasterAdapter(cfg.printer)
    from .printers.mock import MockPrinterAdapter

    out = Path(cfg.printer.mock_output_dir) if cfg.printer.mock_output_dir else Path(cfg.spool_dir) / "mock-printer"
    return MockPrinterAdapter(out)


def build_chute(cfg: AgentConfig) -> ChuteSensor:
    if cfg.chute.adapter == "gpio":
        return GpioChuteSensor(cfg.chute.gpio_pin, cfg.chute.active_low, cfg.chute.bounce_ms)
    if cfg.chute.adapter == "mock":
        return MockChuteSensor()
    return NullChuteSensor()


def build_power(cfg: AgentConfig) -> PowerMonitor:
    if cfg.power.adapter == "mock":
        return MockPowerMonitor()
    return NullPowerMonitor()
