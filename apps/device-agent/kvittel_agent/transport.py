"""HTTPS client for ``/api/device/v1`` (urllib only).

* TLS 1.2+ with system CAs (or a configured CA bundle); redirects are refused
  so the bearer token can never be forwarded to another origin.
* Exponential backoff with jitter (1 s → 60 s cap by default).
* Every JSON response's ``serverTime`` feeds :class:`~kvittel_agent.clock.Clock`.
* Request/response bodies are never logged.
"""

from __future__ import annotations

import http.client
import json
import logging
import random
import ssl
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any, Callable, Optional
from urllib.parse import urlparse

from . import __version__
from .clock import Clock
from .config import validate_server_url

log = logging.getLogger("kvittel.transport")

API_PREFIX = "/api/device/v1"
MAX_RESPONSE_BYTES = 32 * 1024 * 1024
RETRYABLE_STATUS = frozenset({408, 425, 429, 500, 502, 503, 504})


class TransportError(Exception):
    """Network-level failure (DNS, TCP, TLS, timeout, malformed response). Retryable."""


class HttpError(Exception):
    def __init__(self, status: int, code: Optional[str] = None, retry_after_s: Optional[float] = None) -> None:
        super().__init__(f"HTTP {status}" + (f" {code}" if code else ""))
        self.status = status
        self.code = code
        self.retry_after_s = retry_after_s

    @property
    def retryable(self) -> bool:
        return self.status in RETRYABLE_STATUS


class AuthError(HttpError):
    """401/403: token invalid, revoked or missing."""


@dataclass
class Response:
    status: int
    body: Any
    latency_ms: int


class Backoff:
    """Exponential backoff with "equal jitter": delay ∈ [base/2, base], base = min(cap, initial·2^n)."""

    def __init__(self, initial_s: float = 1.0, cap_s: float = 60.0, rng: Callable[[], float] = random.random) -> None:
        self.initial_s = initial_s
        self.cap_s = cap_s
        self._rng = rng

    def delay(self, attempt: int) -> float:
        base = min(self.cap_s, self.initial_s * (2 ** min(attempt, 30)))
        return base / 2.0 + self._rng() * base / 2.0


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[override]
        return None  # urllib then raises HTTPError(3xx)


def _parse_retry_after(value: Optional[str]) -> Optional[float]:
    if not value:
        return None
    try:
        return max(0.0, float(value))
    except ValueError:
        return None


class Transport:
    def __init__(
        self,
        server_url: str,
        clock: Clock,
        token_provider: Optional[Callable[[], Optional[str]]] = None,
        *,
        timeout_s: float = 15.0,
        allow_insecure_http: bool = False,
        ca_file: str = "",
        backoff: Optional[Backoff] = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        validate_server_url(server_url, allow_insecure_http)
        self.server_url = server_url.rstrip("/")
        self.base_url = self.server_url + API_PREFIX
        self.clock = clock
        self.timeout_s = timeout_s
        self.backoff = backoff or Backoff()
        self._token_provider = token_provider or (lambda: None)
        self._sleep = sleep
        handlers: list[Any] = [_NoRedirect()]
        parsed = urlparse(self.server_url)
        if parsed.hostname in ("localhost", "127.0.0.1", "::1"):
            handlers.append(urllib.request.ProxyHandler({}))  # never proxy loopback
        if parsed.scheme == "https":
            ctx = ssl.create_default_context(cafile=ca_file or None)
            ctx.minimum_version = ssl.TLSVersion.TLSv1_2
            handlers.append(urllib.request.HTTPSHandler(context=ctx))
        self._opener = urllib.request.build_opener(*handlers)
        self.last_latency_ms: Optional[int] = None
        self.last_success_wall: Optional[float] = None

    # -- single request -----------------------------------------------------------
    def request(self, method: str, path: str, body: Any = None, *, auth: bool = True) -> Response:
        url = self.base_url + path
        headers = {"Accept": "application/json", "User-Agent": f"kvittel-agent/{__version__}"}
        data: Optional[bytes] = None
        if body is not None:
            data = json.dumps(body, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if auth:
            token = self._token_provider()
            if not token:
                raise AuthError(401, "no_token")
            headers["Authorization"] = f"Bearer {token}"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)

        sent_wall = self.clock.wall()
        t0 = time.monotonic()
        retry_after: Optional[float] = None
        try:
            with self._opener.open(req, timeout=self.timeout_s) as resp:
                status = resp.status
                raw = resp.read(MAX_RESPONSE_BYTES + 1)
        except urllib.error.HTTPError as e:
            status = e.code
            retry_after = _parse_retry_after(e.headers.get("Retry-After") if e.headers else None)
            try:
                raw = e.read(64 * 1024)
            except Exception:
                raw = b""
            finally:
                e.close()
        except (urllib.error.URLError, OSError, http.client.HTTPException, ValueError) as e:
            log.debug("request failed method=%s path=%s err=%s", method, path, type(e).__name__)
            raise TransportError(type(e).__name__) from None
        recv_wall = self.clock.wall()
        latency = int((time.monotonic() - t0) * 1000)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise TransportError("response_too_large")

        parsed: Any = None
        if raw:
            try:
                parsed = json.loads(raw.decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError):
                if 200 <= status < 300:
                    raise TransportError("bad_json") from None
        if isinstance(parsed, dict) and isinstance(parsed.get("serverTime"), str):
            self.clock.observe_server_time(parsed["serverTime"], sent_wall, recv_wall)

        if status >= 300:
            code = parsed.get("error") if isinstance(parsed, dict) and isinstance(parsed.get("error"), str) else None
            log.debug("http error method=%s path=%s status=%s code=%s", method, path, status, code)
            if status in (401, 403):
                raise AuthError(status, code)
            raise HttpError(status, code, retry_after)
        self.last_latency_ms = latency
        self.last_success_wall = recv_wall
        return Response(status, parsed, latency)

    # -- with retries --------------------------------------------------------------
    def request_with_retry(
        self,
        method: str,
        path: str,
        body: Any = None,
        *,
        auth: bool = True,
        deadline_mono: Optional[float] = None,
        max_attempts: Optional[int] = None,
        stop_event: Optional[threading.Event] = None,
    ) -> Response:
        """Retry network errors and retryable statuses. Safe because every mutating call is idempotent."""
        attempt = 0
        while True:
            try:
                return self.request(method, path, body, auth=auth)
            except AuthError:
                raise
            except HttpError as e:
                if not e.retryable:
                    raise
                err: Exception = e
                retry_after = e.retry_after_s
            except TransportError as e:
                err = e
                retry_after = None
            attempt += 1
            if max_attempts is not None and attempt >= max_attempts:
                raise err
            delay = self.backoff.delay(attempt - 1)
            if retry_after is not None:
                delay = max(delay, min(retry_after, self.backoff.cap_s))
            if deadline_mono is not None and time.monotonic() + delay > deadline_mono:
                raise err
            log.debug("retrying method=%s path=%s attempt=%d delay=%.2fs", method, path, attempt, delay)
            if stop_event is not None:
                if stop_event.wait(delay):
                    raise err
            else:
                self._sleep(delay)
