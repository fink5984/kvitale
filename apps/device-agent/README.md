# kvittel-agent (device-agent)

Raspberry Pi field-unit software for Kvittel Global. It prints kvittels on a
thermal printer at the grave and drops them through a chute. It implements
[`docs/DEVICE_PROTOCOL.md`](../../docs/DEVICE_PROTOCOL.md) v1, which is the
authoritative contract.

**Status:** passes its unit tests and state-flow tests against an in-process
fake server. It has **not been tested against a physical printer, chute sensor
or UPS.** All printer-specific behaviour (cutter bytes, status bits, feed pitch)
is marked UNVERIFIED in code and config.

- Python 3.10+. The core uses only the standard library. `pyserial` (serial
  printers) and `gpiozero`/`RPi.GPIO` (chute sensor) are optional and imported
  lazily.
- Install, pairing and operations: [`docs/DEVICE_AGENT_INSTALL.md`](../../docs/DEVICE_AGENT_INSTALL.md)
- Hardware candidates and verification checklist: [`docs/HARDWARE_BOM.md`](../../docs/HARDWARE_BOM.md)

## CLI

```
kvittel-agent [--config FILE] run                 # main loop (systemd)
kvittel-agent pair --code XXXX-XXXX --server URL [--force]
kvittel-agent diagnostics                         # JSON, no content, no secrets
kvittel-agent test-print-local                    # content-free test pattern, no server needed
```

Exit codes: `0` ok, `64` usage, `69` server unavailable (pairing), `75` restart
requested by a signed command (systemd restarts the unit), `78` config error or
not paired.

## Layout

| Module | Role |
|---|---|
| `config.py` | TOML/JSON config, `KVITTEL_*` env overrides, strict validation (unknown keys rejected). On Python 3.10 a strict TOML subset parser is used; 3.11+ uses `tomllib`. |
| `transport.py` | urllib HTTPS client: TLS ≥ 1.2, redirects refused (the token never leaves the paired origin), bearer auth, backoff with jitter (1 s → 60 s), `serverTime` drift tracking. |
| `clock.py` | Drift-corrected UTC clock (a Pi has no RTC, and NTP may not have synced yet). |
| `journal.py` | Append-only `spool/journal.jsonl`, fsync per line, keyed by `commandId`; tolerates a torn last line; compaction. |
| `outbox.py` | Bounded (default 500) persistent outbox, retried strictly in order, idempotent by `eventUid`. |
| `commands.py` | HMAC verification (canonical JSON, rule 5), the closed command set, at-most-once execution, hooks with no shell. |
| `raster.py` | Packed 1-bpp raster validation, FNV-1a digest, `GS v 0` banded encoding (port of `packages/print-layout/src/raster.ts`), PBM, test pattern. |
| `printers/base.py` | `PrinterAdapter` ABC; capabilities are `supported` / `unsupported` / `unverified`. |
| `printers/escpos.py` | `EscPosRasterAdapter` over `/dev/usb/lp*` or serial (pyserial). Generic `DLE EOT` parsing. |
| `printers/mock.py` | `MockPrinterAdapter` writes each page as a PBM file and supports fault injection. |
| `sensors.py` | `ChuteSensor` (GPIO break-beam / mock / null) and `PowerMonitor` (default `unsupported`). |
| `telemetry.py` | Network type, Wi-Fi dBm, uptime and SoC temperature from `/proc` and `/sys`. Missing values become `null`/`unknown`, never invented ones. |
| `agent.py` | Main loop, the print state machine, pairing, and token rotation. |

## Print flow and safety rules

```
heartbeat → verify + run signed commands → flush outbox → lease
  → journal leased → validate raster (digest) → preflight (trusted status, chute not blocked)
  → POST print_started (synchronous; must get next=continue, else NO print)
  → journal printing (fsync)  ← nothing reaches the printer before this
  → per page: GS v 0 raster → ESC d feed → cut   (chute armed before first cut)
  → print_completed → cut_completed → chute_detected | chute_timeout   (via outbox)
```

- **At-most-once printing.** A `commandId` whose journal state is past
  `leased` / `released` / `failed_before_print` is never printed again. If the
  server leases such a command again, the agent reports `interrupted` with
  `reason: already_journaled`, and a human reviews it.
- **Crash recovery.** On boot, any entry left in `printing`, `printed` or
  `cut` is reported as `interrupted`. The server marks it `uncertain` and does
  not replay it automatically.
- **Idempotent events.** `eventUid = uuid5(leaseId + ":" + type)`, so a retry
  sends the same uid even after a reboot.
- **Latched hold.** After a `chute_timeout` or a cutter jam the agent stops
  leasing new jobs until it receives a signed `clear_error`. This keeps slips
  from piling up in a jammed slot.
- **No shell.** `reboot_agent` / `restart_service` run local hooks only.
  Each hook is `"disabled"` (the default), `"exit"` (exit 75, and systemd
  restarts the unit), or a fixed absolute argv that runs without a shell.
  Command payloads never affect what gets executed. `ota_update` always
  answers `ota_not_supported`, because updates are done by an operator.
- **Unverified hardware never drives decisions.** Readings from status queries
  that are not marked `status_verified` appear in `diagnostics` but are not
  acted on. In the heartbeat they are reported as `unsupported`.
- **No content in logs.** Only ids, digests, states and error codes are
  logged. `RasterPage.__repr__` hides the data. A logging filter redacts
  anything that looks like a token or a base64 blob.
  - Note: `MockPrinterAdapter` writes the actual slips to disk as PBM files
    (that is its purpose). Use it only on the bench.

## Tests

```
cd apps/device-agent
python -m unittest discover -s tests -v
```

`tests/fake_server.py` is an `http.server` implementation of the protocol
subset (pair, heartbeat, lease, job events, device events, command results,
token rotation). It computes signatures directly from the spec rather than
reusing agent code, and has knobs for injecting failures.

## Known gaps / open questions

- The protocol doesn't define the digest for a **multi-page** job. The agent
  accepts a digest over the concatenated pages. If the digest doesn't match,
  it logs a warning and continues; it does not reject the job.
- **Signature canonical JSON with floats.** Python and JS serialise floats
  differently (`1.0` vs `1`). Payloads should use integers and strings only.
- `cut: "none"` jobs are printed and fed, but no `cut_completed` event is
  sent (nothing was cut). The server will resolve these by lease expiry.
- The camera is always reported `not_installed`, and there is no camera code.
