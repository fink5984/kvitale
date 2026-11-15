# Operations

## Deployment shape (recommended)
- **Web**: `pnpm build && pnpm start` on Railway / Render / Fly / a VM (Node 22). Vercel works for the web tier, but the device API benefits from a long-lived Node server.
- **Worker**: same image, `KVITTEL_INPROCESS_WORKER=1` on exactly one instance (or a dedicated process); set `0` on the others. The loop runs lease sweeps, scheduled promotion, offline detection and retention purge every 30 s.
- **Database**: managed PostgreSQL 15+ (`DATABASE_URL`), daily backups + PITR.
- **Object storage**: replace `src/server/storage.ts` with an S3-compatible adapter (SSE + signed URLs).
- **Secrets**: provider secret store; never `.env` files on servers. `KVITTEL_DEMO_MODE=0` in production.

## Health & monitoring
- `GET /api/health` → DB round-trip. Alert if non-200 for 2 min.
- Fleet: alerts `device_offline`, `paper_low/end`, `cutter_fault`, `print_uncertain`, `ac_power_lost` appear in Admin → Alerts and on the overview. Hook an email/Slack notifier to new critical alerts (not yet wired).
- Logs are JSON lines with redaction; ship to a log store. Add Sentry/OpenTelemetry with the same redaction (`log.redact`).

## Runbooks
- **Uncertain delivery**: Admin → Orders → item → check the unit physically/camera → *Confirm delivered* / *Re-queue* / *Mark not delivered*, with reason. Never re-queue without checking: it prints again.
- **Paper change**: Operator portal → unit → *Change roll* (3 steps). Resolves paper alerts and resets accounting.
- **Unit offline**: cause is unknown from the server alone (network vs power). Ask the local operator; check `ac_power_lost` only if the unit has a UPS sensor.
- **Replace a unit**: Admin → Pair a unit (same grave) → install → new device paired; old one: revoke on its page. Queue and history stay with the grave.
- **Lost/compromised device**: device page → *Revoke* (immediate 401), then re-pair.
- **Pause a site** (e.g. caretakers request): grave status *paused* → new orders blocked; queued jobs wait; offer refunds.
- **Refunds**: support requests, finance approves (four-eyes); in-flight jobs block refunds until resolved.

## Backups & restore drill
1. Nightly logical dump + provider PITR. 2. Quarterly: restore into a staging DB, run `pnpm db:migrate`, run E2E smoke. 3. Encryption keys are backed up separately (without them, content backups are unreadable — by design).

## Local development
- `pnpm setup` seeds DEMO data. `pnpm db:reset && pnpm setup` for a clean slate (stop the dev server first: PGlite is single-process).
- Simulated device tokens live in `.data/sim-devices.json`.
- E2E: start the server with `KVITTEL_E2E_IGNORE_SCHEDULE=1` so Shabbat/hours windows don't block a test run.
