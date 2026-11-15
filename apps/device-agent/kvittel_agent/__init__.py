"""Kvittel Global field-unit agent (Raspberry Pi).

Implements docs/DEVICE_PROTOCOL.md v1. Core is stdlib-only; ``pyserial`` and
``gpiozero``/``RPi.GPIO`` are optional and imported lazily.
"""

__version__ = "0.1.0"

__all__ = ["__version__"]
