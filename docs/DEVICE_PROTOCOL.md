# Device Protocol — v1

Contract between the Kvittel server and field units (Raspberry Pi `device-agent`, or the `device-simulator`).
Status: **implemented in server + simulator; Python agent implements the same contract. Not yet validated against physical printer hardware.**

## Principles

- **Outbound only.** The device opens HTTPS connections to the server. No inbound ports, no remote shell.
- **Exactly-once physical print is impossible to guarantee**; we guarantee *at-most-once automatic print* per `commandId`, and surface anything ambiguous as `uncertain` for a human.
- **No content in logs.** The device receives a raster bitmap, never plaintext names/requests. Agents must not log raster bytes or decode them.
- **Unknown is a valid answer.** Every sensor field may be `"unsupported"` (hardware cannot measure) or `"unknown"` (should be able to, but no reading). Never fabricate values.

## Transport

- Base URL: `${KVITTEL_SERVER}/api/device/v1`
- JSON over HTTPS (TLS 1.2+). In development `http://localhost:3000` is accepted.
- Auth header: `Authorization: Bearer <device token>` (format `kvd_<base64url>`). The server stores only a SHA-256 hash.
- Clock: every response carries `serverTime` (ISO-8601 UTC). Devices should correct drift with it.
- Retries: exponential backoff with jitter, 1s → 60s cap. All mutating calls are idempotent (see keys below), so retrying is always safe.

## Endpoints

### `POST /pair` (no auth)
One-time pairing with a code created by an admin in **Admin → Devices → Pair new unit** (QR/pairing code, 30 min expiry, single use).

```json
// request
{ "pairingCode": "7H2K-9QXD", "hardwareId": "rpi-serial-00000000abcdef", "agentVersion": "0.1.0", "printerModel": "EP-261C" }
// 200
{ "deviceId": "uuid", "token": "kvd_…", "commandKey": "base64", "serverTime": "…", "config": { "heartbeatSec": 15, "leaseSec": 90, "chuteTimeoutMs": 8000 } }
```
Errors: `400 invalid_code`, `410 code_expired_or_used`, `429 rate_limited`.
The grave assignment comes from the pairing code (asserted by the admin), **never** from device GPS.

### `POST /heartbeat`
Sent every `heartbeatSec` (default 15s).

```json
{
  "seq": 1042,
  "agentVersion": "0.1.0",
  "bootId": "uuid-per-boot",
  "telemetry": {
    "network": "wifi | ethernet | lte | unknown",
    "signalDbm": -61,             // or null
    "latencyMs": 88,              // last RTT measured by the agent, or null
    "power": "ac | battery | unknown | unsupported",
    "batteryPct": 97,             // or null when unsupported
    "paperSensor": "ok | near_end | paper_end | unknown | unsupported",
    "cover": "closed | open | unknown | unsupported",
    "cutter": "ok | fault | unknown | unsupported",
    "chuteSensor": "ok | blocked | fault | unknown | unsupported",
    "camera": "ok | fault | not_installed",
    "tempC": 23.5,                // or null
    "uptimeS": 86400,
    "queueDepth": 0,
    "capabilities": { "power": "supported", "battery": "unsupported", "nearEnd": "supported", "cutterStatus": "unsupported", "chuteSensor": "supported", "camera": "unsupported" }
  },
  "activeJob": { "jobId": "uuid", "leaseId": "…", "phase": "printing" }   // or null
}
```
Response:
```json
{ "serverTime": "…", "paused": false, "config": { "version": 3, "heartbeatSec": 15, "leaseSec": 90, "chuteTimeoutMs": 8000 }, "jobAvailable": true,
  "commands": [ { "id": "uuid", "type": "test_print", "payload": {}, "expiresAt": "…", "signature": "hex" } ] }
```

**Power vs. connectivity:** the server reports `AC power failure` only when a device with `capabilities.power = "supported"` sends `power: "battery"` (or a `power_lost` event). A missed heartbeat alone is reported as `heartbeat missed` / `offline` — cause unknown.

### `POST /jobs/lease`
Ask for the next print job for this device's assigned grave. Server applies service hours, Shabbat/Yom Tov blackout and pause state before leasing.

- `204` — nothing to print.
- `200`:
```json
{ "job": {
  "jobId": "uuid", "commandId": "cmd_…", "leaseId": "lease_…", "leaseExpiresAt": "…", "attemptNo": 1,
  "raster": { "format": "packed-1bpp-msb", "widthDots": 384, "bytesPerRow": 48,
              "pages": [ { "heightDots": 812, "data": "base64…" } ],
              "digest": "384x812-1a2b3c4d", "lengthMm": 113.5, "feedBeforeCutMm": 12, "cut": "full" },
  "isTest": false
} }
```
`digest` = the per-page digests joined with `+`; each page digest is `${widthDots}x${heightDots}-${fnv1a32hex(page bytes)}` (see `rasterDigest`). A mismatch is logged by the agent; it does not block printing.
The lease request body is optional; agents may send `{ "bootId": "…" }`, which the server ignores today.

Packed raster: 1 bit per dot, MSB first, `1 = black`, rows padded to `bytesPerRow`. It maps 1:1 onto ESC/POS `GS v 0` (see `packages/print-layout/src/raster.ts → escposRaster`). Pages are separate slips: print page → feed → cut, for each page.

### `POST /jobs/{jobId}/events`
Report each physical step. Idempotent by `eventUid` (device-generated UUID; retries reuse it).

```json
{ "leaseId": "lease_…", "eventUid": "uuid", "type": "print_started", "at": "…", "data": {} }
```
`type` ∈ `print_started`, `print_completed`, `cut_completed`, `chute_detected`, `chute_timeout`, `failed`, `interrupted`.
`failed.data.error` ∈ `paper_end`, `cover_open`, `cutter_jam`, `printer_offline`, `raster_invalid`, `other`.
`failed.data.phase` ∈ `before_print`, `during_print`, `after_print`.

Response: `{ "status": "<job status>", "next": "continue" | "stop" }` — `stop` means the lease is no longer valid (expired/canceled); the agent must not print.

### `POST /commands/{commandId}/result`
```json
{ "status": "succeeded | failed", "result": { "message": "…" } }
```

### `POST /events`
Batch of device-level events (not tied to a job): `boot`, `cover_open`, `cover_closed`, `paper_end`, `paper_near_end`, `paper_loaded`, `power_lost`, `power_restored`, `cutter_fault`, `chute_sensor_fault`, `spool_overflow`.
```json
{ "events": [ { "eventUid": "uuid", "type": "cover_open", "severity": "critical", "at": "…", "data": {} } ] }
```

### `POST /token/rotate`
Returns a fresh token. The old token stays valid for 10 minutes so an agent that crashes between receive and persist can still authenticate. Agents rotate every 30 days.

## Job state machine (server)

```
queued ─lease→ leased ─print_started→ printing ─print_completed→ printed ─cut_completed→ cut ─chute_detected→ chute_confirmed → delivered
  ▲              │                       │                          │                                   
  │  lease expired before print_started  │ failed / interrupted /   │ chute_timeout / lease expired
  └──────────────┘  failed(before_print) │ lease expired            ▼
     (attempts < 3, else failed)         └──────────────────────→ uncertain  (manual review — NEVER auto-reprinted)
```
- `delivered` with `confidence = sensor_confirmed` only after `chute_detected`.
- If the printer profile has no chute sensor (`chuteSensor: unsupported`), `cut_completed` → `delivered` with `confidence = printer_reported`, shown to the customer as such.
- `scheduled`: payment accepted but the grave is outside service hours / Shabbat / Yom Tov / paused; `notBefore` holds the next window. Payment ≠ delivery.

## Device-side guarantees (agent MUST)

1. Keep a local append-only journal (`spool/journal.jsonl`) keyed by `commandId`. Before printing write `{commandId, state: "printing"}` and fsync.
2. Never print a `commandId` that already has a journal entry beyond `leased`.
3. On boot, for any journal entry stuck in `printing`, send `interrupted` → server marks `uncertain`.
4. Event uploads that fail are queued in a bounded local outbox (default 500 entries) and retried in order.
5. Verify the HMAC signature of every command: `hex(HMAC_SHA256(base64decode(commandKey), id + "." + type + "." + expiresAt + "." + sha256hex(canonicalJson(payload ?? {}))))`, where `canonicalJson` = JSON with object keys sorted lexicographically at every nesting level, separators `,` and `:` with no whitespace, non-ASCII characters emitted as-is (UTF-8; Python: `json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)`). `expiresAt` is the exact string the server sent. Reject expired or invalid commands.
   Command payloads contain only strings, integers and booleans (no floats), because JS and Python serialise floats differently in canonical JSON.
6. Only the closed set of command types is accepted: `test_print`, `pause`, `resume`, `reboot_agent`, `restart_service`, `clear_error`, `diagnostics`, `config_update`, `ota_update`. There is no shell command.

## Failure scenarios covered by tests / simulator knobs

| Scenario | Expected outcome |
|---|---|
| Lease taken, device loses network before printing | Lease expires → job re-queued (safe) |
| Power loss mid-print | Agent reboot sends `interrupted` → `uncertain`, no auto replay |
| Ack lost (event POST fails after print) | Outbox retry with same `eventUid` → idempotent |
| Duplicate callback (`double callback` knob) | Second event ignored (`device_events_uid_uq`) |
| Chute sensor timeout | `uncertain` + critical alert |
| Paper end before print | `failed(before_print)` → re-queued, `paper_end` alert |
| Cutter jam after print | `uncertain` + `cutter_fault` alert |
| Invalid / revoked token | `401` |
| Command with bad signature | Agent rejects, reports `failed: bad_signature` |
