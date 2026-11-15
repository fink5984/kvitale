"""Durable file helpers: atomic replace + fsync, fsync'd appends."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def fsync_dir(path: Path) -> None:
    """fsync a directory so a rename/create inside it is durable (POSIX only)."""
    if os.name != "posix":
        return
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
    fd = os.open(str(path), flags)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def atomic_write_bytes(path: Path, data: bytes, mode: int = 0o600) -> None:
    """Write ``data`` to ``path`` atomically (tmp file + fsync + rename + dir fsync)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        try:
            os.chmod(tmp, mode)
        except OSError:  # pragma: no cover - e.g. exotic filesystems
            pass
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, path)
    except BaseException:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
    fsync_dir(path.parent)


def atomic_write_json(path: Path, obj: Any, mode: int = 0o600) -> None:
    data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    atomic_write_bytes(path, data, mode)


def read_json(path: Path, default: Any = None) -> Any:
    try:
        with open(path, "rb") as fh:
            return json.loads(fh.read().decode("utf-8"))
    except FileNotFoundError:
        return default


def append_line_fsync(path: Path, line: str) -> None:
    """Append one line and fsync before returning. Creates the file (0600) if needed."""
    path = Path(path)
    created = not path.exists()
    path.parent.mkdir(parents=True, exist_ok=True)
    flags = os.O_WRONLY | os.O_APPEND | os.O_CREAT | getattr(os, "O_BINARY", 0)
    fd = os.open(str(path), flags, 0o600)
    try:
        payload = (line.rstrip("\n") + "\n").encode("utf-8")
        view = memoryview(payload)
        while view:
            n = os.write(fd, view)
            view = view[n:]
        os.fsync(fd)
    finally:
        os.close(fd)
    if created:
        fsync_dir(path.parent)
