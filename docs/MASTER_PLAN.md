# Master plan & status

Living document. Update the checkboxes and the capability table whenever a capability changes state. Status as of 2026-11-14.

## Milestones

### M0 — Architecture + design sprint ✅
- [x] Stack decisions and ADRs ([ARCHITECTURE.md](ARCHITECTURE.md))
- [x] Design system "Nocturne & Limestone", two art directions, tokens, type in all scripts (`/design`, [UX_DESIGN_SYSTEM.md](UX_DESIGN_SYSTEM.md))
- [x] i18n he/en/fr/ru live; yi/es/pt/de catalogs present, gated off
- [x] DB schema + migrations + DEMO seed (8 graves, 3 simulated units, 160 orders)
- [x] Auth skeleton (magic link + OTP), RBAC, audit log
- [x] Device simulator baseline

### M1 — Public experience ✅
- [x] Home (hero, live search, featured, journey, delivery proof, hilulot, principles)
- [x] Directory with transliteration-tolerant search & filters (works without JS)
- [x] Grave page (availability, service hours in local TZ, hilula, honest map state, demand button)
- [x] Kvittel builder: names, topics, free text, handwriting upload (crop/rotate/contrast), templates, live preview drawn by the print engine, 1-bit "as printed" view, mobile bottom-sheet preview, unsupported-glyph detection
- [x] Draft survives navigation and language switch (session storage; opt-in device memory; wipe)

### M2 — Orders & checkout ✅ (with mock provider)
- [x] Multi-grave basket, bundle discount, coupons, server-authoritative quote
- [x] Payment provider adapter: mock (DEMO hosted page + signed webhook), Stripe (implemented, untested)
- [x] Signed, idempotent webhook as only source of payment truth; amount/currency verification
- [x] Tracking page with token or session; live timeline in grave-local time; confidence level
- [x] Emails (dev mailbox): magic link, order confirmation, delivered / uncertain / failed
- [x] Account: history, claim guest orders after email proof, saved names (consented, encrypted), favourites, export, delete

### M3 — Device control plane ✅ (simulated hardware)
- [x] Protocol v1 ([DEVICE_PROTOCOL.md](DEVICE_PROTOCOL.md)): pairing, heartbeat, lease, events, commands (HMAC-signed), token rotation
- [x] Postgres queue with `FOR UPDATE SKIP LOCKED`, leases, idempotent events, uncertain path, retries only before printing
- [x] Server raster rendering (Skia) with the shared layout engine; ESC/POS encoder
- [x] Paper accounting with uncertainty, days-to-empty, near-end override, alerts
- [x] Python Raspberry Pi agent with journal/outbox, mock + ESC/POS adapters (85 tests)
- [x] Browser Device Lab + CLI simulator with all failure knobs

### M4 — Admin & CMS ✅
- [x] Overview KPIs with period comparison & drill-down; demo-data disclosure
- [x] Orders (search, filters, CSV), order detail (items, jobs, attempts, payments, refunds with four-eyes approval, break-glass content view, audit)
- [x] Graves CMS (8 languages, aliases, location verification, hours/blackouts, hilula, media with rights gating, publish permission, preview)
- [x] Pricing (versioned defaults, per-grave overrides, bundle, coupons, history), Finance (+CSV), Customers (anonymise), Partners, Content/legal, Settings (integrations, flags, roles, localization coverage), Audit, global search
- [x] Fleet: devices list/detail/telemetry/commands/credentials/assignment, pairing with QR, alerts & maintenance tickets, device events

### M5 — Customers, partners, maintenance ✅ (core) / ⏳ (extensions)
- [x] Operator portal scoped to partner graves: unit status, paper, roll-change wizard, tickets, test print
- [ ] Maintenance photo uploads, spare-parts inventory, SLA escalation notifications
- [ ] Partner settlements (schema ready, flag `partner_settlements`)

### M6 — Internationalisation expansion & quality ⏳
- [x] he/en/fr/ru UI; Playwright checks for missing strings, overflow and RTL at 390/1440
- [x] yi/es/pt/de public catalogs translated (machine-assisted) — **awaiting native QA**, disabled
- [ ] Native review of all languages; legal review of policy texts
- [ ] Lighthouse/Core Web Vitals measurement on production build & hosting (not yet measured — no claim made)
- [ ] Monitoring/alerting integration (Sentry/OTel) and backup drill on real infrastructure

### M7 — Future flags ⏳
- [ ] Camera delivery clips, hilula scheduler & reminders, scheduled deliveries, AI phrasing helper (consented), partner API, OTA release manager, advanced finance

## Capability status

| Capability | Status | Notes |
|---|---|---|
| Public site, search, grave pages, builder, preview | **Implemented** | he/en/fr/ru |
| Shared layout engine (preview == print) | **Implemented** | Hebrew/niqqud, Yiddish, Latin, Cyrillic, bidi verified by render |
| Checkout, pricing, coupons, multi-grave | **Implemented** | server-authoritative |
| Payment provider | **Simulated** | Mock provider with signed webhooks. Stripe adapter **awaiting credentials** + business decision |
| Emails | **Simulated** | Dev mailbox. SMTP/Resend adapter **awaiting provider** |
| Magic link / OTP auth, RBAC, audit | **Implemented** | OAuth = future |
| Print queue, leases, uncertain handling | **Implemented** | |
| Field units | **Simulated** | Browser lab, CLI, Python agent with mock printer. **Awaiting hardware** for ESC/POS cut/status verification |
| Optical chute sensor, UPS power sensing | **Awaiting hardware** | Interfaces + protocol fields implemented; "unsupported" shown until present |
| Paper accounting & prediction | **Implemented** | Needs calibration on real rolls |
| Shabbat / Yom Tov / hours | **Implemented** | Conservative cut-off; zmanim need verified coordinates |
| Encryption at rest of content & uploads | **Implemented** | App-level AES-256-GCM; key management via env/KMS in prod |
| Retention purge | **Implemented** | 30 days after delivery (configurable) |
| Tax invoices | **Awaiting external service** | Must come from a licensed provider |
| FX conversion | **Future** | Fixed per-currency price lists by design |
| WhatsApp, push, PWA | **Future** | Flags off |
| Camera proof video | **Future** | Privacy design in SECURITY_PRIVACY.md |
| yi/es/pt/de UI | **Awaiting native QA** | Catalogs exist |
| Legal texts | **Draft** | Require counsel per jurisdiction |
| Lighthouse ≥ 90 | **Not measured** | Measure on production hosting |
