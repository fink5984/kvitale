/**
 * PRODUCTION base seed — configuration only, no demo content.
 * Inserts what a real deployment needs to function (printer profile, feature flags with demo OFF,
 * alert rules, settings, default price list, legal page drafts). Only ever INSERTS MISSING rows:
 * it never updates or deletes anything, so it is safe to re-run against a live database.
 *
 *   pnpm db:seed:base            # local PGlite
 *   pnpm db:seed:base --yes      # required when DATABASE_URL is set (prints the target first)
 */
import { createDb } from "../src/client";
import { describeDatabaseUrl, loadLocalEnv } from "../src/env-file";
import * as s from "../src/schema";
import { FEATURE_FLAGS, PRICE_DEFAULTS } from "./seed-data";
import { LEGAL_PAGES } from "./seed-pages";

loadLocalEnv();
const target = describeDatabaseUrl(process.env.DATABASE_URL);
console.log(`→ target: ${target}`);
if (process.env.DATABASE_URL && !process.argv.includes("--yes")) {
  console.error("Refusing to touch a DATABASE_URL database without --yes.");
  process.exit(1);
}
const h = await createDb();
await h.migrate();
const db = h.db;

await db.insert(s.printerProfiles).values({
  id: "thermal-58mm-203dpi", label: "Thermal 58mm · 203dpi · 384 dots", model: "Candidate: EP-261C / EP-260C / SP-RME3 / EP5803 (unverified)", dotsPerMm: 8, widthDots: 384,
  capabilities: { raster_gs_v_0: "unverified", full_cut: "unverified", cut_status_report: "unverified", near_end_sensor: "unverified", paper_end_sensor: "unverified", cover_open_sensor: "unverified", realtime_status_dle_eot: "unverified" },
  notes: "No capability is assumed until verified on the physical model. See docs/DEVICE_PROTOCOL.md.",
}).onConflictDoNothing();
await db.insert(s.featureFlags).values(FEATURE_FLAGS.map(([key, enabled, description]) => ({ key, enabled: key === "demo_mode" ? false : enabled, description }))).onConflictDoNothing();
await db.insert(s.alertRules).values([
  { key: "heartbeat_missed", severity: "warning", params: { minutes: 5 } },
  { key: "device_offline", severity: "critical", params: { minutes: 30 } },
  { key: "paper_low", severity: "warning", params: { serviceLeadDays: 4, minPct: 15 } },
  { key: "paper_end", severity: "critical", params: {} },
  { key: "cover_open", severity: "critical", params: {} },
  { key: "cutter_fault", severity: "critical", params: {} },
  { key: "print_uncertain", severity: "critical", params: {} },
  { key: "ac_power_lost", severity: "warning", params: {} },
  { key: "chute_sensor_fault", severity: "warning", params: {} },
]).onConflictDoNothing();
await db.insert(s.settings).values([
  { key: "brand", value: { name: { he: "קוויטלה", en: "KVITALE", fr: "KVITALE", ru: "KVITALE" }, tagline: null } },
  { key: "currencies", value: ["USD", "EUR", "ILS", "GBP", "CAD", "AUD"] },
  { key: "retention", value: { kvittelContentDays: 30, proofVideoDays: 14, auditDays: 730 } },
  { key: "payment_provider", value: { active: "stripe", available: ["stripe"] } },
]).onConflictDoNothing();

const havePrices = await db.select({ id: s.prices.id }).from(s.prices).limit(1);
if (!havePrices.length) {
  const from = new Date(Date.now() - 86400000);
  for (const [currency, p] of Object.entries(PRICE_DEFAULTS)) {
    await db.insert(s.prices).values([
      { scope: "default", item: "kvittel", currency, amountMinor: p.kvittel, validFrom: from },
      { scope: "default", item: "extra_page", currency, amountMinor: p.extra_page, validFrom: from },
    ]);
  }
  await db.insert(s.prices).values({ scope: "default", item: "bundle_discount_bps", currency: "ANY", amountMinor: 1000, validFrom: from });
  console.log("→ default price list inserted (REVIEW in Admin → Pricing before launch)");
}
const havePages = await db.select({ id: s.pages.id }).from(s.pages).limit(1);
if (!havePages.length) {
  for (const p of LEGAL_PAGES) {
    const [page] = await db.insert(s.pages).values({ slug: p.slug, kind: "legal", published: true }).returning();
    for (const [locale, t] of Object.entries(p.tr)) await db.insert(s.pageTranslations).values({ pageId: page!.id, locale, title: t.title, body: t.body, reviewed: false });
  }
  console.log("→ legal page DRAFTS inserted (need legal review)");
}
console.log("✓ base configuration present");
await h.close();
