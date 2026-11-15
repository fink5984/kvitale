# CLAUDE.md — working agreements for this repository

Read `docs/MASTER_PLAN.md` first (milestones + capability status), then the doc relevant to your task.

## Non-negotiables
- **Never present simulated things as real.** Mock payments, simulated devices and seed data are labelled DEMO. No faux interactions, no random chart data, no "delivered" without a hardware event.
- **Kvittel content is sensitive.** It is encrypted (`seal()`), rendered to a raster only for printing, never logged, never in URLs, analytics, audit meta, CSV exports or emails. Use `log` from `src/server/log.ts` (redacting). Content access in admin = `kvittel.content.read` + reason + audit.
- **Server-side authorization on every action.** Pages use `guardPage()`; server actions/route handlers call `requirePermission()` and, for partner roles, `assertGraveScope()`.
- **Payment truth comes only from signed, idempotent webhooks** (`processPaymentEvent`). Never mark paid from a redirect.
- **At-most-once automatic printing.** Ambiguity → `uncertain` + human review. Do not add auto-retry after `print_started`.
- **No hardcoded UI text.** All strings in `apps/web/messages/<locale>/*.json` (every file in a locale folder is deep-merged). Add English first, Hebrew for anything user-facing; other locales stay English copies until translated. Never put a literal `<word` in a message (ICU tag).
- **RTL first-class:** use logical classes (`ms-/me-/ps-/pe-/start-/end-`), `<bdi>` around names, refs and signed amounts, `flip-rtl` on directional icons.
- **Never change print layout rules in two places.** `packages/print-layout` is the single engine for preview and printer.

## Conventions
- Stack: Next.js 15 App Router, React 19, TypeScript strict, Tailwind v4 tokens in `src/app/globals.css`, next-intl 4, Drizzle + PostgreSQL (PGlite in dev), Zod 4.
- UI kit: `@/components/ui` (server-safe) + `ui/client.tsx` (Radix). Admin kit: `@/components/admin/kit.tsx`.
- Money = integer minor units + ISO currency; prices are versioned rows; orders store a snapshot.
- Timestamps UTC; every grave has an IANA timezone; schedules evaluated in grave-local time (`src/server/schedule.ts`).
- Schema changes: edit `packages/db/src/schema.ts` → `pnpm db:generate` → commit the SQL migration.
- Device protocol changes: update `docs/DEVICE_PROTOCOL.md`, server (`src/server/queue.ts`, `devices.ts`), `packages/device-sim`, and `apps/device-agent` together.

## Verify before claiming done
`pnpm typecheck && pnpm test`, then E2E for flows you touched (`apps/web/e2e/*.spec.ts`), and screenshots at 390 and 1440 in `he` and `en`.
