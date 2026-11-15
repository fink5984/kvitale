"""Logging setup with a content-safety net.

Policy: log only ids, digests, states and error codes — never raster bytes,
payloads or tokens. Call sites follow that policy; :class:`SafetyFilter` is a
second line of defence that redacts anything that looks like a long base64 /
hex blob or a bearer token, and truncates oversized messages.
"""

from __future__ import annotations

import logging
import re
import sys

_BLOB_RE = re.compile(r"[A-Za-z0-9+/=_-]{120,}")
_TOKEN_RE = re.compile(r"kvd_[A-Za-z0-9_-]+")
MAX_MESSAGE_CHARS = 600


class SafetyFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:  # malformed format args: keep the template only
            msg = str(record.msg)
        clean = _TOKEN_RE.sub("kvd_[redacted]", msg)
        clean = _BLOB_RE.sub("[redacted-blob]", clean)
        if len(clean) > MAX_MESSAGE_CHARS:
            clean = clean[:MAX_MESSAGE_CHARS] + "…[truncated]"
        record.msg = clean
        record.args = None
        return True


def setup_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)
    handler = logging.StreamHandler(sys.stderr)  # journald captures stderr
    handler.setFormatter(logging.Formatter("%(levelname)s %(name)s: %(message)s"))
    handler.addFilter(SafetyFilter())
    root.addHandler(handler)
    root.setLevel(getattr(logging, str(level).upper(), logging.INFO))
