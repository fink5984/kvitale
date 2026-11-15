"""Agent configuration: TOML or JSON file + ``KVITTEL_*`` environment overrides.

On Python 3.11+ TOML is parsed with :mod:`tomllib`. On 3.10 (no tomllib) a
small, strict subset parser is used: ``[tables]``, ``key = value`` with
strings, integers, floats, booleans and single-line arrays. Anything outside
that subset raises :class:`ConfigError` instead of being silently misread.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass, field, fields, is_dataclass
from pathlib import Path
from typing import Any, Dict, List, Mapping, Union
from urllib.parse import urlparse

DEFAULT_CONFIG_PATH = "/etc/kvittel-agent/config.toml"

HookSpec = Union[str, List[str]]  # "disabled" | "exit" | ["/abs/path", "arg", ...]


class ConfigError(ValueError):
    pass


@dataclass
class PrinterConfig:
    adapter: str = "mock"                 # "mock" | "escpos"
    connection: str = "file"              # "file" (/dev/usb/lp0) | "serial" (pyserial)
    device: str = "/dev/usb/lp0"
    serial_baud: int = 9600
    serial_flow_control: str = "none"     # "none" | "rtscts"  (XON/XOFF is unsafe with binary raster)
    model: str = "unknown"                # reported at pairing only
    width_dots: int = 384                 # 58 mm @ 203 dpi — UNVERIFIED per model
    dots_per_mm: float = 8.0              # 203 dpi — UNVERIFIED per model
    band_rows: int = 256
    write_chunk_bytes: int = 4096
    # UNVERIFIED: cutter command differs by model. GS V 0 (1D 56 00) is a common
    # "full cut"; set "" to declare the cutter unsupported.
    cut_command_hex: str = "1d5600"
    partial_cut_command_hex: str = ""     # empty → partial cuts use cut_command_hex
    line_feed_mm: float = 4.23            # ESC d n line pitch (1/6") — UNVERIFIED per model
    est_print_speed_mm_s: float = 50.0    # wait after writing a page; 0 disables — UNVERIFIED
    status_query: bool = False            # send DLE EOT n real-time status queries
    status_timeout_ms: int = 300
    # Set to true only after running the HARDWARE_BOM verification checklist on the
    # exact model + firmware. Until then readings are shown in diagnostics only.
    status_verified: bool = False
    cut_verified: bool = False
    raster_verified: bool = False
    mock_output_dir: str = ""             # default: <spool_dir>/mock-printer


@dataclass
class ChuteConfig:
    adapter: str = "none"                 # "none" | "gpio" | "mock"
    gpio_pin: int = 17                    # BCM numbering
    active_low: bool = True               # receiver output pulled low when beam is broken
    bounce_ms: int = 5


@dataclass
class PowerConfig:
    adapter: str = "none"                 # "none" (unsupported) | "mock"


@dataclass
class HooksConfig:
    # "disabled" (default: log + report failed), "exit" (process exits with code 75,
    # systemd Restart=always restarts it), or an absolute argv list run WITHOUT a shell.
    reboot_agent: HookSpec = "disabled"
    restart_service: HookSpec = "disabled"


@dataclass
class AgentConfig:
    server_url: str = ""
    token_file: str = "/var/lib/kvittel-agent/credentials.json"
    spool_dir: str = "/var/lib/kvittel-agent/spool"
    log_level: str = "INFO"
    http_timeout_s: float = 15.0
    allow_insecure_http: bool = False     # http:// allowed for localhost regardless
    ca_file: str = ""                     # optional private CA bundle
    outbox_max: int = 500
    token_rotate_days: int = 30
    heartbeat_sec: int = 15               # defaults until the server sends config
    lease_sec: int = 90
    chute_timeout_ms: int = 8000
    backoff_initial_s: float = 1.0
    backoff_max_s: float = 60.0
    printer: PrinterConfig = field(default_factory=PrinterConfig)
    chute: ChuteConfig = field(default_factory=ChuteConfig)
    power: PowerConfig = field(default_factory=PowerConfig)
    hooks: HooksConfig = field(default_factory=HooksConfig)


ENV_OVERRIDES: Dict[str, str] = {
    "KVITTEL_SERVER": "server_url",
    "KVITTEL_TOKEN_FILE": "token_file",
    "KVITTEL_SPOOL_DIR": "spool_dir",
    "KVITTEL_LOG_LEVEL": "log_level",
    "KVITTEL_CA_FILE": "ca_file",
    "KVITTEL_ALLOW_INSECURE_HTTP": "allow_insecure_http",
    "KVITTEL_PRINTER_ADAPTER": "printer.adapter",
    "KVITTEL_PRINTER_CONNECTION": "printer.connection",
    "KVITTEL_PRINTER_DEVICE": "printer.device",
    "KVITTEL_CHUTE_ADAPTER": "chute.adapter",
}


# --- TOML subset parser (Python 3.10 fallback) ----------------------------------

_BARE_KEY = re.compile(r"^[A-Za-z0-9_-]+$")


def _strip_comment(line: str) -> str:
    quote = None
    i = 0
    while i < len(line):
        c = line[i]
        if quote:
            if c == "\\" and quote == '"':
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in ('"', "'"):
            quote = c
        elif c == "#":
            return line[:i]
        i += 1
    return line


def _split_key(key: str, lineno: int) -> List[str]:
    parts = []
    for raw in key.split("."):
        k = raw.strip()
        if len(k) >= 2 and k[0] == k[-1] and k[0] in "\"'":
            k = k[1:-1]
        elif not _BARE_KEY.match(k):
            raise ConfigError(f"line {lineno}: invalid key")
        parts.append(k)
    return parts


def _split_array_items(body: str, lineno: int) -> List[str]:
    items, cur, quote, i = [], "", None, 0
    while i < len(body):
        c = body[i]
        if quote:
            cur += c
            if c == "\\" and quote == '"' and i + 1 < len(body):
                cur += body[i + 1]
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in ('"', "'"):
            quote = c
            cur += c
        elif c == "[":
            raise ConfigError(f"line {lineno}: nested arrays are not supported")
        elif c == ",":
            items.append(cur.strip())
            cur = ""
        else:
            cur += c
        i += 1
    if quote:
        raise ConfigError(f"line {lineno}: unterminated string")
    if cur.strip():
        items.append(cur.strip())
    return items


def _parse_value(v: str, lineno: int) -> Any:
    if not v:
        raise ConfigError(f"line {lineno}: missing value")
    if v.startswith('"""') or v.startswith("'''"):
        raise ConfigError(f"line {lineno}: multi-line strings are not supported")
    if v[0] == '"':
        if len(v) < 2 or v[-1] != '"':
            raise ConfigError(f"line {lineno}: unterminated string")
        try:
            return json.loads(v)
        except json.JSONDecodeError:
            raise ConfigError(f"line {lineno}: invalid string") from None
    if v[0] == "'":
        if len(v) < 2 or v[-1] != "'" or "'" in v[1:-1]:
            raise ConfigError(f"line {lineno}: invalid literal string")
        return v[1:-1]
    if v == "true":
        return True
    if v == "false":
        return False
    if v[0] == "[":
        if v[-1] != "]":
            raise ConfigError(f"line {lineno}: arrays must be on one line in the 3.10 fallback parser")
        return [_parse_value(item, lineno) for item in _split_array_items(v[1:-1], lineno)]
    num = v.replace("_", "")
    if re.fullmatch(r"[+-]?\d+", num):
        return int(num)
    if re.fullmatch(r"[+-]?(\d+\.\d+([eE][+-]?\d+)?|\d+[eE][+-]?\d+)", num):
        return float(num)
    raise ConfigError(f"line {lineno}: unsupported value")


def parse_toml_subset(text: str) -> Dict[str, Any]:
    root: Dict[str, Any] = {}
    current = root
    for lineno, raw in enumerate(text.splitlines(), 1):
        line = _strip_comment(raw).strip()
        if not line:
            continue
        if line.startswith("[["):
            raise ConfigError(f"line {lineno}: arrays of tables are not supported")
        if line.startswith("["):
            if not line.endswith("]"):
                raise ConfigError(f"line {lineno}: invalid table header")
            current = root
            for part in _split_key(line[1:-1], lineno):
                nxt = current.setdefault(part, {})
                if not isinstance(nxt, dict):
                    raise ConfigError(f"line {lineno}: key redefined as table")
                current = nxt
            continue
        key, sep, value = line.partition("=")
        if not sep:
            raise ConfigError(f"line {lineno}: expected key = value")
        keys = _split_key(key, lineno)
        target = current
        for k in keys[:-1]:
            target = target.setdefault(k, {})
            if not isinstance(target, dict):
                raise ConfigError(f"line {lineno}: key redefined as table")
        if keys[-1] in target:
            raise ConfigError(f"line {lineno}: duplicate key")
        target[keys[-1]] = _parse_value(value.strip(), lineno)
    return root


def parse_toml(text: str) -> Dict[str, Any]:
    try:
        import tomllib  # type: ignore[import-not-found]  # Python 3.11+
    except ModuleNotFoundError:
        return parse_toml_subset(text)
    try:
        return tomllib.loads(text)
    except tomllib.TOMLDecodeError as e:
        raise ConfigError(f"invalid TOML: {e}") from None


# --- mapping → dataclasses --------------------------------------------------------

def _coerce(name: str, current: Any, value: Any) -> Any:
    if isinstance(current, bool):
        if not isinstance(value, bool):
            raise ConfigError(f"{name}: expected boolean")
        return value
    if isinstance(current, int):
        if isinstance(value, bool) or not isinstance(value, int):
            raise ConfigError(f"{name}: expected integer")
        return value
    if isinstance(current, float):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ConfigError(f"{name}: expected number")
        return float(value)
    if isinstance(current, str) and not name.startswith("hooks."):
        if not isinstance(value, str):
            raise ConfigError(f"{name}: expected string")
        return value
    return value  # hooks: validated separately


def _apply(obj: Any, data: Mapping[str, Any], prefix: str = "") -> None:
    known = {f.name: f for f in fields(obj)}
    for key, value in data.items():
        if key not in known:
            raise ConfigError(f"unknown config key: {prefix}{key}")
        current = getattr(obj, key)
        if is_dataclass(current):
            if not isinstance(value, Mapping):
                raise ConfigError(f"{prefix}{key}: expected a table")
            _apply(current, value, f"{prefix}{key}.")
        else:
            setattr(obj, key, _coerce(f"{prefix}{key}", current, value))


def _parse_bool(s: str) -> bool:
    if s.strip().lower() in ("1", "true", "yes", "on"):
        return True
    if s.strip().lower() in ("0", "false", "no", "off", ""):
        return False
    raise ConfigError("invalid boolean in environment override")


def _apply_env(cfg: AgentConfig, env: Mapping[str, str]) -> None:
    for var, dotted in ENV_OVERRIDES.items():
        if var not in env:
            continue
        raw = env[var]
        *parents, leaf = dotted.split(".")
        target: Any = cfg
        for p in parents:
            target = getattr(target, p)
        current = getattr(target, leaf)
        if isinstance(current, bool):
            setattr(target, leaf, _parse_bool(raw))
        else:
            setattr(target, leaf, raw)


def validate_hook(name: str, spec: Any) -> HookSpec:
    if spec in ("disabled", "exit"):
        return spec
    if isinstance(spec, list) and spec and all(isinstance(a, str) and a for a in spec):
        if not os.path.isabs(spec[0]) and not spec[0].startswith("/"):
            raise ConfigError(f"hooks.{name}: argv[0] must be an absolute path")
        return list(spec)
    raise ConfigError(f'hooks.{name}: must be "disabled", "exit" or an absolute argv list')


def validate_server_url(url: str, allow_insecure_http: bool) -> None:
    p = urlparse(url)
    if p.scheme not in ("https", "http") or not p.hostname:
        raise ConfigError("server_url must be an http(s) URL")
    if p.scheme == "http" and not allow_insecure_http and p.hostname not in ("localhost", "127.0.0.1", "::1"):
        raise ConfigError("server_url must use https (http only for localhost or allow_insecure_http)")
    if p.username or p.password:
        raise ConfigError("server_url must not contain credentials")


def validate(cfg: AgentConfig) -> AgentConfig:
    if cfg.printer.adapter not in ("mock", "escpos"):
        raise ConfigError("printer.adapter must be 'mock' or 'escpos'")
    if cfg.printer.connection not in ("file", "serial"):
        raise ConfigError("printer.connection must be 'file' or 'serial'")
    if cfg.printer.serial_flow_control not in ("none", "rtscts"):
        raise ConfigError("printer.serial_flow_control must be 'none' or 'rtscts'")
    if cfg.chute.adapter not in ("none", "gpio", "mock"):
        raise ConfigError("chute.adapter must be 'none', 'gpio' or 'mock'")
    if cfg.power.adapter not in ("none", "mock"):
        raise ConfigError("power.adapter must be 'none' or 'mock'")
    for hex_field in ("cut_command_hex", "partial_cut_command_hex"):
        val = getattr(cfg.printer, hex_field).replace(" ", "")
        if val and (len(val) % 2 or not re.fullmatch(r"[0-9a-fA-F]+", val) or len(val) > 32):
            raise ConfigError(f"printer.{hex_field} must be up to 16 hex bytes")
    if not (8 <= cfg.printer.width_dots <= 2048):
        raise ConfigError("printer.width_dots out of range")
    if not (1 <= cfg.printer.band_rows <= 4096):
        raise ConfigError("printer.band_rows out of range")
    if not (1 <= cfg.outbox_max <= 100000):
        raise ConfigError("outbox_max out of range")
    if cfg.http_timeout_s <= 0 or cfg.backoff_initial_s <= 0 or cfg.backoff_max_s < cfg.backoff_initial_s:
        raise ConfigError("invalid timeout/backoff settings")
    cfg.hooks.reboot_agent = validate_hook("reboot_agent", cfg.hooks.reboot_agent)
    cfg.hooks.restart_service = validate_hook("restart_service", cfg.hooks.restart_service)
    if cfg.server_url:
        validate_server_url(cfg.server_url, cfg.allow_insecure_http)
    return cfg


def load_config(path: str | os.PathLike[str] | None = None, env: Mapping[str, str] | None = None) -> AgentConfig:
    """Load config from ``path`` (TOML or ``.json``), apply env overrides, validate.

    A missing file at the *default* path is fine (defaults + env); a missing file
    at an explicitly given path is an error.
    """
    env = os.environ if env is None else env
    cfg = AgentConfig()
    explicit = path is not None
    p = Path(path) if path is not None else Path(env.get("KVITTEL_CONFIG", DEFAULT_CONFIG_PATH))
    if p.exists():
        text = p.read_text(encoding="utf-8")
        data = json.loads(text) if p.suffix.lower() == ".json" else parse_toml(text)
        if not isinstance(data, dict):
            raise ConfigError("config root must be a table/object")
        _apply(cfg, data)
    elif explicit:
        raise ConfigError(f"config file not found: {p}")
    _apply_env(cfg, env)
    return validate(cfg)
