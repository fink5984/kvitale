"""CLI: ``kvittel-agent {run,pair,diagnostics,test-print-local}``."""

from __future__ import annotations

import argparse
import json
import logging
import signal
import sys
import threading
from typing import List, Optional

from . import __version__
from .agent import Agent, NotPaired, pair_device
from .config import AgentConfig, ConfigError, load_config
from .factory import build_chute, build_power, build_printer
from .logutil import setup_logging
from .transport import HttpError, TransportError

log = logging.getLogger("kvittel.cli")

EXIT_USAGE = 64
EXIT_UNAVAILABLE = 69
EXIT_CONFIG = 78

PAIR_ERRORS = {
    "invalid_code": "pairing code is invalid",
    "code_expired_or_used": "pairing code expired or already used — create a new one in Admin → Devices",
    "rate_limited": "too many pairing attempts — wait and retry",
}


def _build_agent(cfg: AgentConfig) -> Agent:
    return Agent(cfg, printer=build_printer(cfg), chute=build_chute(cfg), power=build_power(cfg))


def cmd_run(cfg: AgentConfig) -> int:
    agent = _build_agent(cfg)
    stop = threading.Event()

    def _stop(signum: int, _frame: object) -> None:
        log.info("signal %d received; stopping", signum)
        stop.set()

    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    try:
        agent.boot()
    except NotPaired as e:
        log.error("%s - run `kvittel-agent pair --code XXXX-XXXX --server URL` first", e)
        return EXIT_CONFIG
    log.info("agent %s started boot=%s", __version__, agent.boot_id)
    return agent.run(stop)


def cmd_pair(cfg: AgentConfig, args: argparse.Namespace) -> int:
    server = args.server or cfg.server_url
    if not server:
        print("error: --server is required (or set server_url in config)", file=sys.stderr)
        return EXIT_USAGE
    try:
        creds = pair_device(cfg, server, args.code, force=args.force)
    except HttpError as e:
        print(f"pairing failed: {PAIR_ERRORS.get(e.code or '', f'HTTP {e.status}')}", file=sys.stderr)
        return EXIT_UNAVAILABLE
    except TransportError as e:
        print(f"pairing failed: server unreachable ({e})", file=sys.stderr)
        return EXIT_UNAVAILABLE
    except (ValueError, ConfigError) as e:
        print(f"pairing failed: {e}", file=sys.stderr)
        return EXIT_USAGE
    print(json.dumps({"paired": True, "deviceId": creds.device_id, "server": creds.server_url}))
    return 0


def cmd_diagnostics(cfg: AgentConfig) -> int:
    agent = _build_agent(cfg)
    try:
        agent.creds = agent.creds_store.load()
    except NotPaired:
        agent.creds = None
    print(json.dumps(agent.diagnostics(), indent=2, default=str))
    return 0


def cmd_test_print_local(cfg: AgentConfig) -> int:
    agent = _build_agent(cfg)
    outcome = agent.print_test_pattern()
    print(json.dumps(outcome.result_body()))
    return 0 if outcome.status == "succeeded" else 1


def main(argv: Optional[List[str]] = None) -> int:
    p = argparse.ArgumentParser(prog="kvittel-agent", description="Kvittel Global field-unit agent")
    p.add_argument("--config", help="config file (TOML or .json); default $KVITTEL_CONFIG or /etc/kvittel-agent/config.toml")
    p.add_argument("--version", action="version", version=__version__)
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("run", help="run the agent loop (used by systemd)")
    pp = sub.add_parser("pair", help="pair this unit using a one-time code from Admin → Devices")
    pp.add_argument("--code", required=True, help="pairing code, e.g. 7H2K-9QXD")
    pp.add_argument("--server", help="server base URL, e.g. https://kvittel.example")
    pp.add_argument("--force", action="store_true", help="overwrite existing credentials")
    sub.add_parser("diagnostics", help="print local diagnostics as JSON (no content, no secrets)")
    sub.add_parser("test-print-local", help="print a content-free test pattern without contacting the server")
    args = p.parse_args(argv)

    try:
        cfg = load_config(args.config)
    except (ConfigError, OSError, ValueError) as e:
        print(f"config error: {e}", file=sys.stderr)
        return EXIT_CONFIG
    setup_logging(cfg.log_level)

    if args.command == "run":
        return cmd_run(cfg)
    if args.command == "pair":
        return cmd_pair(cfg, args)
    if args.command == "diagnostics":
        return cmd_diagnostics(cfg)
    if args.command == "test-print-local":
        return cmd_test_print_local(cfg)
    return EXIT_USAGE


if __name__ == "__main__":
    sys.exit(main())
