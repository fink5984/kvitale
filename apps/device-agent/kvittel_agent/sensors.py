"""Chute (slot-exit) sensor and power monitor interfaces.

The chute sensor counts slips passing an IR break-beam after the agent arms
it. A break-beam only proves "something interrupted the beam"; it cannot
tell a slip from a finger or an insect. Treat it as evidence, not proof.
"""

from __future__ import annotations

import logging
import threading
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

log = logging.getLogger("kvittel.sensors")


class ChuteSensor(ABC):
    @abstractmethod
    def capability(self) -> str:
        """"supported" | "unsupported" | "unverified"."""

    @abstractmethod
    def state(self) -> str:
        """"ok" | "blocked" | "fault" | "unknown" | "unsupported"."""

    @abstractmethod
    def arm(self) -> None:
        """Reset the drop counter; subsequent beam breaks are counted."""

    @abstractmethod
    def wait_for_drops(self, expected: int, timeout_s: float) -> int:
        """Block until ``expected`` drops were counted or timeout. Returns the count."""

    def close(self) -> None:
        pass


class NullChuteSensor(ChuteSensor):
    def capability(self) -> str:
        return "unsupported"

    def state(self) -> str:
        return "unsupported"

    def arm(self) -> None:
        pass

    def wait_for_drops(self, expected: int, timeout_s: float) -> int:
        return 0


class _CountingSensor(ChuteSensor):
    def __init__(self) -> None:
        self._cond = threading.Condition()
        self._count = 0
        self._armed = False

    def _on_break(self, *_: Any) -> None:
        with self._cond:
            if self._armed:
                self._count += 1
                self._cond.notify_all()

    def arm(self) -> None:
        with self._cond:
            self._count = 0
            self._armed = True

    def wait_for_drops(self, expected: int, timeout_s: float) -> int:
        deadline = time.monotonic() + max(0.0, timeout_s)
        with self._cond:
            while self._count < expected:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    break
                self._cond.wait(remaining)
            self._armed = False
            return self._count


class MockChuteSensor(_CountingSensor):
    """Simulates drops ``delay_s`` after arming (``detect=False`` → never; ``fault`` → fault state)."""

    def __init__(self, detect: bool = True, delay_s: float = 0.01, fault: bool = False, blocked: bool = False) -> None:
        super().__init__()
        self.detect = detect
        self.delay_s = delay_s
        self.fault = fault
        self.blocked = blocked
        self.drops_per_arm = 1
        self._timer: Optional[threading.Timer] = None

    def capability(self) -> str:
        return "supported"

    def state(self) -> str:
        if self.fault:
            return "fault"
        return "blocked" if self.blocked else "ok"

    def arm(self) -> None:
        super().arm()
        if self.detect and not self.fault:
            def fire() -> None:
                for _ in range(self.drops_per_arm):
                    self._on_break()
            self._timer = threading.Timer(self.delay_s, fire)
            self._timer.daemon = True
            self._timer.start()

    def trigger(self) -> None:
        self._on_break()


class GpioChuteSensor(_CountingSensor):
    """IR break-beam receiver on a GPIO pin (BCM). Uses gpiozero, else RPi.GPIO; unsupported if neither.

    Wiring assumption (typical open-collector receiver, UNVERIFIED for your part):
    output pulled up → HIGH while beam intact, LOW while broken (``active_low=True``).
    """

    def __init__(self, pin: int, active_low: bool = True, bounce_ms: int = 5) -> None:
        super().__init__()
        self.pin = pin
        self.active_low = active_low
        self._backend: Optional[str] = None
        self._dev: Any = None
        self._gpio: Any = None
        self._error: Optional[str] = None
        try:
            from gpiozero import DigitalInputDevice  # type: ignore[import-not-found]

            self._dev = DigitalInputDevice(pin, pull_up=active_low, bounce_time=bounce_ms / 1000.0 or None)
            self._dev.when_activated = self._on_break
            self._backend = "gpiozero"
        except ImportError:
            try:
                import RPi.GPIO as GPIO  # type: ignore[import-not-found]

                GPIO.setmode(GPIO.BCM)
                GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP if active_low else GPIO.PUD_DOWN)
                GPIO.add_event_detect(pin, GPIO.FALLING if active_low else GPIO.RISING,
                                      callback=self._on_break, bouncetime=max(1, bounce_ms))
                self._gpio = GPIO
                self._backend = "RPi.GPIO"
            except ImportError:
                log.warning("chute sensor: no GPIO library available; capability unsupported")
            except Exception as e:  # RuntimeError on non-Pi hardware etc.
                self._error = type(e).__name__
        except Exception as e:  # gpiozero BadPinFactory etc.
            self._error = type(e).__name__
        if self._error:
            log.warning("chute sensor: GPIO init failed (%s)", self._error)

    def capability(self) -> str:
        if self._backend is None and self._error is None:
            return "unsupported"
        return "supported"

    def _beam_broken(self) -> bool:
        if self._backend == "gpiozero":
            return bool(self._dev.is_active)
        level = self._gpio.input(self.pin)
        return (level == 0) if self.active_low else (level == 1)

    def state(self) -> str:
        if self._backend is None:
            return "fault" if self._error else "unsupported"
        try:
            # Beam broken while no slip is expected → something is stuck in the slot.
            return "blocked" if (self._beam_broken() and not self._armed) else "ok"
        except Exception:
            return "fault"

    def close(self) -> None:
        try:
            if self._dev is not None:
                self._dev.close()
            if self._gpio is not None:
                self._gpio.remove_event_detect(self.pin)
        except Exception:
            pass


# --- power ------------------------------------------------------------------------------

class PowerMonitor(ABC):
    @abstractmethod
    def capabilities(self) -> Dict[str, str]:
        """{"power": ..., "battery": ...}"""

    @abstractmethod
    def status(self) -> Dict[str, Any]:
        """{"power": "ac|battery|unknown|unsupported", "batteryPct": int|None}"""


class NullPowerMonitor(PowerMonitor):
    """Default: no UPS HAT integrated → power state is honestly unsupported."""

    def capabilities(self) -> Dict[str, str]:
        return {"power": "unsupported", "battery": "unsupported"}

    def status(self) -> Dict[str, Any]:
        return {"power": "unsupported", "batteryPct": None}


class MockPowerMonitor(PowerMonitor):
    def __init__(self, power: str = "ac", battery_pct: Optional[int] = 100) -> None:
        self.power = power
        self.battery_pct = battery_pct

    def capabilities(self) -> Dict[str, str]:
        return {"power": "supported", "battery": "supported" if self.battery_pct is not None else "unsupported"}

    def status(self) -> Dict[str, Any]:
        return {"power": self.power, "batteryPct": self.battery_pct}
