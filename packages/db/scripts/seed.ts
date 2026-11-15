/**
 * Seeds DEMO data. Idempotent: refuses to run twice unless --force (which wipes demo rows).
 * Run while the web server is stopped when using PGlite (single process).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createDb, repoRoot } from "../src/client";
import { describeDatabaseUrl, loadLocalEnv } from "../src/env-file";
import { normalizeSearch, scriptOf } from "../src/normalize";
import * as s from "../src/schema";
import { randomToken, seal, sha256 } from "../src/secrets";
import { DEMO_USERS, FEATURE_FLAGS, PRICE_DEFAULTS, SEED_GRAVES } from "./seed-data";
import { LEGAL_PAGES } from "./seed-pages";

loadLocalEnv();
// DEMO data may only ever be created in an explicit, local, throw-away database.
if (process.env.DATABASE_URL || process.env.KVITTEL_DEMO_MODE !== "1") {
  console.error("Refusing to seed DEMO data: it requires KVITTEL_DEMO_MODE=1 and NO DATABASE_URL (local PGlite only). For a real deployment use: pnpm db:seed:base");
  process.exit(1);
}
console.log(`→ target: ${describeDatabaseUrl(process.env.DATABASE_URL)}`);
const h = await createDb();
await h.migrate();
const db = h.db;

const existing = await db.select({ id: s.graves.id }).from(s.graves).limit(1);
if (existing.length && !process.argv.includes("--force")) {
  console.log("Database already seeded. Use `pnpm db:reset && pnpm setup` for a fresh demo.");
  await h.close();
  process.exit(0);
}

// deterministic PRNG so demo dashboards are reproducible
let seed = 20261113;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const now = Date.now();
const days = (n: number) => new Date(now - n * 86400000);

console.log("→ printer profile, flags, rules");
await db.insert(s.printerProfiles).values({
  id: "thermal-58mm-203dpi",
  label: "Thermal 58mm · 203dpi · 384 dots",
  model: "Candidate: EP-261C / EP-260C / SP-RME3 / EP5803 (unverified)",
  dotsPerMm: 8,
  widthDots: 384,
  capabilities: {
    raster_gs_v_0: "unverified",
    full_cut: "unverified",
    cut_status_report: "unverified",
    near_end_sensor: "unverified",
    paper_end_sensor: "unverified",
    cover_open_sensor: "unverified",
    realtime_status_dle_eot: "unverified",
  },
  notes: "No capability is assumed until verified on the physical model. See docs/DEVICE_PROTOCOL.md.",
});
await db.insert(s.featureFlags).values(FEATURE_FLAGS.map(([key, enabled, description]) => ({ key, enabled, description })));
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
]);
await db.insert(s.settings).values([
  { key: "brand", value: { name: { he: "קוויטל", en: "Kvittel", fr: "Kvittel", ru: "Квитл" }, tagline: null } },
  { key: "currencies", value: ["USD", "EUR", "ILS", "GBP", "CAD", "AUD"] },
  { key: "retention", value: { kvittelContentDays: 30, proofVideoDays: 14, auditDays: 730 } },
  { key: "payment_provider", value: { active: "mock", available: ["mock", "stripe"] } },
]);

console.log("→ partners & users");
const [pKerestir] = await db.insert(s.partners).values({ name: "Kerestir Site Committee (DEMO)", kind: "operator", contactEmail: "partner@demo.kvittel.local", locale: "he", isDemo: true }).returning();
const [pLizhensk] = await db.insert(s.partners).values({ name: "Leżajsk Local Service (DEMO)", kind: "technician", locale: "en", isDemo: true }).returning();
const partnerBySlug: Record<string, string> = { kerestir: pKerestir!.id, lizhensk: pLizhensk!.id };

const userIds: Record<string, string> = {};
for (const u of DEMO_USERS) {
  const [row] = await db.insert(s.users).values({ email: u.email, displayName: u.name, locale: "he", currency: "ILS", emailVerifiedAt: new Date(), isDemo: true }).returning();
  userIds[u.role] = row!.id;
  await db.insert(s.roleAssignments).values({ userId: row!.id, role: u.role, partnerId: "partner" in u ? partnerBySlug[u.partner] : null });
}

console.log("→ graves");
const graveIds: Record<string, string> = {};
for (const g of SEED_GRAVES) {
  const [loc] = await db.insert(s.locations).values({ countryCode: g.country, cityKey: g.cityKey, verified: false, verificationSource: null }).returning();
  const [row] = await db
    .insert(s.graves)
    .values({
      slug: g.slug,
      status: g.status,
      locationId: loc!.id,
      timezone: g.timezone,
      dynasty: g.dynasty,
      eraStartYear: g.era[0],
      eraEndYear: g.era[1],
      featured: g.featured,
      sortOrder: g.sort,
      permitStatus: g.status === "active" || g.status === "maintenance" ? "approved" : g.status === "coming_soon" ? "requested" : "none",
      permitNotes: "DEMO — no real permit on file",
      operatorPartnerId: partnerBySlug[g.slug] ?? null,
      israelHolidays: g.israelHolidays ?? false,
      demandCount: Math.floor(rnd() * 400) + 20,
      isDemo: true,
      publishedAt: new Date(),
    })
    .returning();
  graveIds[g.slug] = row!.id;
  for (const [locale, t] of Object.entries(g.tr)) {
    await db.insert(s.graveTranslations).values({
      graveId: row!.id,
      locale,
      name: t.name,
      epithet: t.epithet,
      placeName: t.place,
      bio: t.bio,
      bioSources: "DEMO text — awaiting verified sources",
      customs: t.customs,
      metaTitle: t.name,
      metaDescription: t.bio.slice(0, 155),
      reviewed: false,
    });
  }
  const aliasSet = new Set([...g.aliases, ...Object.values(g.tr).map((t) => t.name)]);
  await db.insert(s.graveAliases).values([...aliasSet].map((a) => ({ graveId: row!.id, alias: a, script: scriptOf(a), normalized: normalizeSearch(a) })));
  await db.insert(s.graveHilulot).values({ graveId: row!.id, hebrewDay: g.hilula.day, hebrewMonth: g.hilula.month, hebrewYearOfPassing: g.hilula.year ?? null, sourceNote: "Commonly cited date — verify before publication", verified: false });
  // Service hours: Sun–Thu 07:00–21:00, Fri 07:00–12:00 local. Saturday closed.
  const sched = [0, 1, 2, 3, 4].map((wd) => ({ graveId: row!.id, weekday: wd, openMinute: 420, closeMinute: 1260 }));
  sched.push({ graveId: row!.id, weekday: 5, openMinute: 420, closeMinute: 720 });
  await db.insert(s.graveSchedules).values(sched);
  if (partnerBySlug[g.slug]) await db.insert(s.partnerGraves).values({ partnerId: partnerBySlug[g.slug]!, graveId: row!.id });
}
await db.insert(s.partnerAgreements).values({ partnerId: pKerestir!.id, revenueShareBps: 1500, currency: "EUR", validFrom: days(120), notes: "DEMO agreement" });

console.log("→ prices & coupons");
for (const [currency, p] of Object.entries(PRICE_DEFAULTS)) {
  await db.insert(s.prices).values([
    { scope: "default", item: "kvittel", currency, amountMinor: p.kvittel, validFrom: days(200) },
    { scope: "default", item: "extra_page", currency, amountMinor: p.extra_page, validFrom: days(200) },
  ]);
}
await db.insert(s.prices).values([
  { scope: "default", item: "bundle_discount_bps", currency: "ANY", amountMinor: 1000, validFrom: days(200) },
  // superseded price (history) + current override for Lizhensk in USD
  { scope: "grave", graveId: graveIds.lizhensk, item: "kvittel", currency: "USD", amountMinor: 1800, version: 1, validFrom: days(200), validTo: days(30) },
  { scope: "grave", graveId: graveIds.lizhensk, item: "kvittel", currency: "USD", amountMinor: 2000, version: 2, validFrom: days(30) },
]);
await db.insert(s.coupons).values([
  { code: "WELCOME10", kind: "percent", value: 1000, maxRedemptions: 1000 },
  { code: "HILULA5", kind: "fixed", value: 500, currency: "USD", maxRedemptions: 200, validTo: new Date(now + 60 * 86400000) },
]);

console.log("→ simulated devices");
const simFile: Array<{ deviceId: string; serial: string; token: string; grave: string; name: string }> = [];
const deviceIds: Record<string, string> = {};
for (const [slug, status, name] of [
  ["kerestir", "active", "Kerestir · Unit A"],
  ["lizhensk", "active", "Leżajsk · Unit A"],
  ["berditchev", "maintenance", "Berdychiv · Unit A"],
] as const) {
  const serial = `SIM-${slug.toUpperCase().slice(0, 4)}-0001`;
  const lastSeen = status === "active" ? new Date(now - 60_000) : days(2);
  const telemetry = {
    network: "wifi",
    signalDbm: status === "active" ? -58 : null,
    latencyMs: status === "active" ? 84 : null,
    power: "ac",
    batteryPct: 100,
    paperSensor: slug === "lizhensk" ? "near_end" : "ok",
    cover: "closed",
    cutter: status === "maintenance" ? "fault" : "ok",
    chuteSensor: "ok",
    camera: "not_installed",
    tempC: 21,
    uptimeS: 86400 * 3,
    queueDepth: 0,
    agentVersion: "0.1.0-sim",
    capabilities: { power: "supported", battery: "supported", nearEnd: "supported", cutterStatus: "supported", chuteSensor: "supported", camera: "unsupported" },
  };
  const [d] = await db
    .insert(s.devices)
    .values({ serial, name, status, printerProfileId: "thermal-58mm-203dpi", agentVersion: "0.1.0-sim", lastSeenAt: lastSeen, lastTelemetry: telemetry, isSimulated: true })
    .returning();
  deviceIds[slug] = d!.id;
  const token = `kvd_${randomToken(24)}`;
  await db.insert(s.deviceCredentials).values({ deviceId: d!.id, tokenHash: sha256(token), tokenPrefix: token.slice(0, 10) });
  await db.insert(s.deviceAssignments).values({ deviceId: d!.id, graveId: graveIds[slug]!, assignedAt: days(90), assertedBy: userIds.super_admin, note: "DEMO assignment" });
  await db.insert(s.deviceConfig).values({ deviceId: d!.id, config: { heartbeatSec: 15, leaseSec: 90, chuteTimeoutMs: 8000, printDensity: 8 } });
  await db.insert(s.paperRolls).values({
    deviceId: d!.id,
    installedAt: days(slug === "lizhensk" ? 26 : 9),
    outerDiameterMm: 40,
    coreDiameterMm: 12,
    thicknessMm: 0.06,
    usedMm: slug === "lizhensk" ? 16800 : slug === "kerestir" ? 7200 : 3100,
    calibrationFactor: slug === "kerestir" ? 0.97 : null,
    installedBy: userIds.local_maintainer,
  });
  // 72h of hourly telemetry for charts
  const rows = [];
  for (let i = 72; i >= 0; i--) {
    const online = status === "active" || i > 48;
    if (!online) continue;
    rows.push({
      deviceId: d!.id,
      at: new Date(now - i * 3600_000),
      data: { ...telemetry, signalDbm: -52 - Math.round(rnd() * 18), latencyMs: 40 + Math.round(rnd() * 120), queueDepth: Math.round(rnd() * 2) },
    });
  }
  await db.insert(s.deviceTelemetry).values(rows);
  simFile.push({ deviceId: d!.id, serial, token, grave: slug, name });
}
mkdirSync(path.join(repoRoot(), ".data"), { recursive: true });
writeFileSync(path.join(repoRoot(), ".data", "sim-devices.json"), JSON.stringify(simFile, null, 2));

console.log("→ alerts & maintenance");
const [aPaper] = await db.insert(s.alerts).values({ kind: "paper_low", severity: "warning", deviceId: deviceIds.lizhensk, graveId: graveIds.lizhensk, dedupeKey: `paper_low:${deviceIds.lizhensk}`, data: { remainingPct: 11.8, daysToEmpty: 2.6 } }).returning();
const [aCut] = await db.insert(s.alerts).values({ kind: "cutter_fault", severity: "critical", status: "acknowledged", deviceId: deviceIds.berditchev, graveId: graveIds.berditchev, dedupeKey: `cutter_fault:${deviceIds.berditchev}`, acknowledgedAt: days(1), acknowledgedBy: userIds.super_admin, openedAt: days(2) }).returning();
await db.insert(s.maintenanceTickets).values([
  { graveId: graveIds.lizhensk, deviceId: deviceIds.lizhensk, alertId: aPaper!.id, kind: "paper_change", title: "Replace paper roll before weekend", status: "open", priority: 2, dueAt: new Date(now + 2 * 86400000), createdBy: userIds.super_admin },
  { graveId: graveIds.berditchev, deviceId: deviceIds.berditchev, alertId: aCut!.id, kind: "cutter", title: "Cutter fault — inspect blade and sensor", status: "waiting_parts", priority: 1, dueAt: new Date(now + 86400000), createdBy: userIds.super_admin, assigneeUserId: userIds.local_maintainer },
]);

console.log("→ demo orders");
const locales = ["he", "he", "he", "en", "en", "fr", "ru"] as const;
const curByLocale: Record<string, string[]> = { he: ["ILS", "ILS", "USD"], en: ["USD", "USD", "GBP", "CAD", "AUD"], fr: ["EUR"], ru: ["USD", "EUR"] };
const activeSlugs = ["kerestir", "kerestir", "lizhensk", "lizhensk", "berditchev"];
for (let i = 0; i < 160; i++) {
  const ageDays = Math.pow(rnd(), 0.8) * 60;
  const created = new Date(now - ageDays * 86400000);
  const locale = pick(locales);
  const currency = pick(curByLocale[locale]!);
  const nGraves = rnd() < 0.18 ? 2 : 1;
  const slugs = nGraves === 2 ? ["kerestir", "lizhensk"] : [pick(activeSlugs)];
  const unit = PRICE_DEFAULTS[currency]!.kvittel;
  const pages = rnd() < 0.12 ? 2 : 1;
  const itemTotal = unit + (pages - 1) * PRICE_DEFAULTS[currency]!.extra_page;
  const subtotal = itemTotal * slugs.length;
  const discount = slugs.length > 1 ? Math.round(subtotal * 0.1) : 0;
  const total = subtotal - discount;
  const roll = rnd();
  const outcome = ageDays < 0.3 ? "queued" : roll < 0.9 ? "delivered" : roll < 0.94 ? "refunded" : roll < 0.97 ? "failed" : "uncertain";
  const ref = `KV-${(0x100000 + Math.floor(rnd() * 0xeffff)).toString(16).toUpperCase()}`;
  const [order] = await db
    .insert(s.orders)
    .values({
      publicRef: ref,
      email: `guest${i}@demo.kvittel.local`,
      locale,
      currency,
      subtotalMinor: subtotal,
      discountMinor: discount,
      totalMinor: total,
      status: outcome === "delivered" ? "fulfilled" : outcome === "refunded" ? "refunded" : outcome === "queued" ? "paid" : "attention",
      priceSnapshot: { unit, extraPage: PRICE_DEFAULTS[currency]!.extra_page, bundleBps: 1000, source: "seed" },
      marketingConsent: rnd() < 0.3,
      countryHint: locale === "he" ? "IL" : locale === "fr" ? "FR" : locale === "ru" ? pick(["IL", "US", "DE"]) : pick(["US", "GB", "CA", "AU"]),
      isDemo: true,
      createdAt: created,
      paidAt: created,
      userId: i % 23 === 0 ? userIds.customer : null,
    })
    .returning();
  const content = { template: "classic", nusach: locale === "he" ? "he" : locale, graveDisplayName: "DEMO", people: [{ id: "1", mode: "free", given: "", relation: "none", freeText: "DEMO" }], topics: [], request: "", showBH: true };
  const [kv] = await db
    .insert(s.kvittels)
    .values({ contentEnc: seal(JSON.stringify(content)), contentDigest: sha256(JSON.stringify(content)), template: "classic", nusach: content.nusach, pageCount: pages, lengthMm: 78 + pages * 60, layoutVersion: "1.0.0", createdAt: created })
    .returning();
  const [pay] = await db
    .insert(s.payments)
    .values({ orderId: order!.id, provider: "mock", providerRef: `mock_${randomToken(10)}`, status: outcome === "refunded" ? "refunded" : "succeeded", amountMinor: total, currency, feeMinor: Math.round(total * 0.029) + 30, refundedMinor: outcome === "refunded" ? total : 0, isDemo: true, createdAt: created, succeededAt: created })
    .returning();
  if (outcome === "refunded")
    await db.insert(s.refunds).values({ paymentId: pay!.id, amountMinor: total, currency, reason: "DEMO: grave paused before delivery", status: "succeeded", requestedBy: userIds.support_limited, approvedBy: userIds.finance, createdAt: new Date(created.getTime() + 86400000) });
  for (const slug of slugs) {
    const itemStatus = outcome === "delivered" ? "delivered" : outcome === "refunded" ? "refunded" : outcome === "queued" ? "queued" : outcome;
    const delivered = new Date(created.getTime() + (5 + rnd() * 90) * 60000);
    const [item] = await db
      .insert(s.orderItems)
      .values({ orderId: order!.id, graveId: graveIds[slug]!, kvittelId: kv!.id, pages, unitPriceMinor: unit, extrasMinor: (pages - 1) * PRICE_DEFAULTS[currency]!.extra_page, discountMinor: Math.round(discount / slugs.length), totalMinor: itemTotal - Math.round(discount / slugs.length), status: itemStatus as never, deliveredAt: outcome === "delivered" ? delivered : null, deliveryConfidence: outcome === "delivered" ? "sensor_confirmed" : null, createdAt: created })
      .returning();
    if (outcome === "refunded") continue;
    const jobStatus = outcome === "delivered" ? "delivered" : outcome === "queued" ? "queued" : outcome;
    const [job] = await db
      .insert(s.printJobs)
      .values({ orderItemId: item!.id, graveId: graveIds[slug]!, deviceId: outcome === "queued" ? null : deviceIds[slug], commandId: `cmd_${randomToken(12)}`, status: jobStatus as never, attempts: outcome === "queued" ? 0 : 1, lengthMm: 78 + pages * 60, confidence: outcome === "delivered" ? "sensor_confirmed" : null, lastError: outcome === "failed" ? "paper_end before print start" : outcome === "uncertain" ? "chute sensor timeout after print_complete" : null, createdAt: created, deliveredAt: outcome === "delivered" ? delivered : null })
      .returning();
    if (outcome !== "queued")
      await db.insert(s.printAttempts).values({ jobId: job!.id, deviceId: deviceIds[slug]!, attemptNo: 1, leaseId: `lease_${randomToken(10)}`, leasedAt: created, startedAt: outcome === "failed" ? null : created, printedAt: outcome === "failed" ? null : delivered, cutAt: outcome === "delivered" ? delivered : null, chuteAt: outcome === "delivered" ? delivered : null, outcome: outcome === "delivered" ? "delivered" : outcome === "failed" ? "failed_before_print" : "uncertain", error: outcome === "failed" ? "paper_end" : outcome === "uncertain" ? "chute_timeout" : null });
  }
}

console.log("→ content pages");
for (const p of LEGAL_PAGES) {
  const [page] = await db.insert(s.pages).values({ slug: p.slug, kind: "legal", published: true }).returning();
  for (const [locale, t] of Object.entries(p.tr)) await db.insert(s.pageTranslations).values({ pageId: page!.id, locale, title: t.title, body: t.body, reviewed: false });
}

await db.insert(s.auditLogs).values({ actorKind: "system", action: "seed.demo", meta: { graves: SEED_GRAVES.length, orders: 160 } });
console.log("✓ demo seed complete. Simulated device tokens → .data/sim-devices.json");
await h.close();
