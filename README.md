# Kvittel Global · קוויטל

A platform to write a kvittel from anywhere in the world and have it **physically printed, cut and passed into the kvittel opening** at the tziyun of a tzaddik — by a small unit installed with the caretakers' permission, with sensor-confirmed delivery and privacy by design.

> Working name. Everything shipped here runs in **DEMO mode** by default: payments, printers and seed data are simulated and clearly labelled as such.

## Quick start (Windows / macOS / Linux — no Docker)

Requirements: Node 22+, pnpm 10, (optional) Python 3.10+ for the device agent, Google Chrome for E2E.

```bash
pnpm install
pnpm setup          # migrate + seed DEMO data into embedded PostgreSQL (.data/pglite)
pnpm dev            # http://localhost:3000  → redirects to /he
```

Then open:

| URL | What |
|---|---|
| `/he`, `/en`, `/fr`, `/ru` | Public site |
| `/en/write?grave=kerestir` | Kvittel builder with live print preview |
| `/en/login` | Magic link / OTP sign-in + **DEMO quick sign-in** per role |
| `/en/admin` | Admin console (sign in as *Super admin*) |
| `/en/admin/lab` | Device Lab: a simulated printer running the real protocol in your browser |
| `/en/operator` | Local operator portal (sign in as *Local maintainer*) |
| `/en/dev/mailbox` | Emails captured instead of sent (DEMO) |
| `/en/design` | Design system: art directions, tokens, type specimens, components |

Simulate field units headlessly (dev server must be running):

```bash
pnpm sim                                   # all simulated units, every 3 s
pnpm sim -- --device kerestir --chute-fail # knobs: --offline --paper near_end|paper_end --cover-open --cutter-jam --ac-off --double-callback --reboot-mid-print --drop-ack --once
```

## Commands

| Command | |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js web app |
| `pnpm setup` · `pnpm db:migrate` · `pnpm db:seed` · `pnpm db:reset` | Database (stop the dev server first when using PGlite) |
| `pnpm db:generate` | Generate a new SQL migration from `packages/db/src/schema.ts` |
| `pnpm typecheck` · `pnpm lint` · `pnpm test` | Static checks + unit/integration tests |
| `pnpm e2e` | Playwright E2E (server on :3000 started with `KVITTEL_E2E_IGNORE_SCHEDULE=1`) |
| `cd apps/device-agent && python -m unittest discover -s tests` | Raspberry Pi agent tests |

## Repository

```
apps/web              Next.js 15 (App Router) — public site, admin, operator portal, device API
apps/device-agent     Python agent for Raspberry Pi field units (stdlib only)
apps/device-simulator Headless simulator CLI
packages/print-layout Shared kvittel layout engine: browser preview == printer raster; ESC/POS; paper accounting
packages/db           Drizzle schema, migrations, seed, encryption helpers
packages/device-sim   Isomorphic simulated device (browser lab + CLI + E2E)
docs/                 Plan, architecture, design system, protocol, security, operations, localization, roadmap
```

Start with [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md) — it contains the milestone checklist and the **Implemented / Simulated / Awaiting external service / Future** table.
