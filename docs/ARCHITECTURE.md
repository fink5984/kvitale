# Architecture

```
 Browser (he/en/fr/ru…)                    Raspberry Pi field unit
 ┌──────────────────────┐                  ┌──────────────────────────┐
 │ Next.js pages (RSC)  │                  │ kvittel-agent (Python)   │
 │ Builder: canvas      │                  │ journal · outbox · HMAC  │
 │  └ print-layout ─────┼── same engine ───┼─▶ ESC/POS raster printer │
 └─────────┬────────────┘                  └───────────┬──────────────┘
           │ server actions / route handlers           │ HTTPS outbound only
 ┌─────────▼───────────────────────────────────────────▼──────────────┐
 │ apps/web (Next.js 15, Node runtime)                                 │
 │  auth/session · rbac · orders · pricing · payments adapter          │
 │  webhooks (signed, idempotent) · queue (leases, SKIP LOCKED)        │
 │  devices (pairing, heartbeat, commands) · alerts · email adapter    │
 │  print (Skia raster via print-layout/node) · storage (encrypted)    │
 │  worker loop (in-process in dev; separate process in prod)         │
 └─────────┬──────────────────────────────────────────────────────────┘
           │ Drizzle ORM
     PostgreSQL (prod) / PGlite embedded Postgres (dev)
```

## Packages
- **packages/print-layout** — pure TS layout engine (`layoutKvittel`) with a pluggable `Measurer`, renderer for any Canvas2D, 1-bit packing, ESC/POS `GS v 0`, paper accounting. `./node` adds Skia rendering & image sanitisation.
- **packages/db** — schema (≈60 tables), client factory (PGlite or node-postgres), seed, AES-GCM `seal/openSealed`, search normalisation.
- **packages/device-sim** — `SimulatedDevice` used by the admin Device Lab, the CLI, and E2E tests.
- **apps/device-agent** — production-shaped Python agent (stdlib), see DEVICE_AGENT_INSTALL.md.

## ADRs (short)

1. **Next.js App Router monolith** for public site, admin and device API. One deployable, server components for SEO, server actions for forms. A separate worker process runs the same `workerTick()`.
2. **PostgreSQL + Drizzle; PGlite in development.** The user's machine had no Docker and no usable DB credentials; PGlite is real Postgres (same SQL, same migrations), so `DATABASE_URL` switches to a managed DB with no code change. Constraint: PGlite is single-process — seed with the server stopped.
3. **Postgres as the queue (no Redis/BullMQ in MVP).** Print jobs need transactional coupling with orders and payments; `SELECT … FOR UPDATE SKIP LOCKED` + leases gives safe concurrency at our volume (hundreds/day per site). Revisit at >50 jobs/s.
4. **HTTPS polling + leases instead of MQTT** for devices. Simpler NAT traversal on cellular, no broker to operate, idempotency explicit in the protocol. Heartbeat 15 s; jobs signalled via `jobAvailable`.
5. **Server-side raster rendering.** The device never receives text, only a 1-bit bitmap → no fonts or bidi logic on the Pi, and no readable content on the unit. The same engine and TTFs render the browser preview.
6. **Custom magic-link/OTP auth** (sessions table, hashed tokens) rather than Auth.js: guest-first flows, email ownership proof for claiming guest orders, minimal surface. OAuth can be added beside it.
7. **next-intl with locale-prefixed routes**; catalogs split per feature file and deep-merged; extra locales enabled by env after QA.
8. **App-level encryption** (AES-256-GCM) for kvittel content, saved names and uploads, keyed from env/KMS — independent of database-at-rest encryption.
9. **In-memory search index** with Hebrew/Yiddish/Latin/Cyrillic folding + Latin consonant skeleton + Levenshtein. Fine to thousands of graves; move to pg_trgm when needed.
10. **Fixed per-currency price lists** instead of FX conversion: no fabricated rates; price snapshot stored per order.

## Key flows
- **Order**: builder → `validateKvittel` (server render) → cart → `checkout` (server quote, encrypt, order/items, tracking token in httpOnly cookie) → provider → **webhook** → `processPaymentEvent` (dedupe by `(provider,event_id)`, amount check) → print jobs `queued|scheduled` → email.
- **Print**: device heartbeat → `jobAvailable` → `/jobs/lease` (sweep, schedule check, SKIP LOCKED, attempt row, render) → events `print_started → print_completed → cut_completed → chute_detected` → delivered; any ambiguity → `uncertain` + alert; human resolves in admin.
- **Scheduling**: `closedReason()` in grave TZ: hours, Shabbat, Yom Tov (hebcal, diaspora/Israel), Friday/Erev cut-off. Paid jobs wait as `scheduled` with `notBefore`.

## Data model highlights
UTC timestamps + IANA TZ per grave · money in minor units · versioned `prices` + `orders.price_snapshot` · `print_jobs.command_id` unique (device idempotency) · `device_events(device_id,event_uid)` unique · partial unique index on open alerts dedupe key · `is_demo` on seed records.
