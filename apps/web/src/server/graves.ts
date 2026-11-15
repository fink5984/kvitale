import "server-only";
import { and, asc, desc, eq, inArray, isNull, lte, or, gt } from "drizzle-orm";
import {
  deviceAssignments,
  devices,
  graveAliases,
  graveHilulot,
  graveMedia,
  graveSchedules,
  graves,
  graveTranslations,
  locations,
  normalizeSearch,
  prices,
} from "@kvittel/db";
import { getDb } from "./db";
import { closedReason, nextHilula, nextOpenAt, type ClosedReason, type GraveServicePolicy } from "./schedule";

export type GraveStatus = "discovery_only" | "coming_soon" | "active" | "paused" | "maintenance";

export type Availability =
  | { kind: "available_now" }
  | { kind: "scheduled"; reason: ClosedReason | "device_offline" | "maintenance"; nextOpenAt: string | null }
  | { kind: "not_purchasable"; reason: "discovery_only" | "coming_soon" | "paused" | "no_device" };

export interface GraveCardData {
  id: string;
  slug: string;
  status: GraveStatus;
  name: string;
  nameHe: string;
  epithet: string | null;
  place: string | null;
  countryCode: string;
  timezone: string;
  dynasty: string | null;
  era: [number | null, number | null];
  featured: boolean;
  isDemo: boolean;
  translationLocale: string;
  hilula: { date: string; hebrewDay: number; hebrewMonth: number; verified: boolean } | null;
  availability: Availability;
  fromPrice: { amountMinor: number; currency: string } | null;
  hasMedia: boolean;
  /** First rights-verified photo, if any. Served by /api/media/grave/[id]. */
  cover: { id: string; width: number | null; height: number | null; alt: string | null } | null;
}

export interface GraveDetailData extends GraveCardData {
  bio: string | null;
  bioSources: string | null;
  customs: string | null;
  address: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  faq: Array<{ q: string; a: string }>;
  aliases: string[];
  location: { lat: number | null; lng: number | null; verified: boolean };
  schedules: Array<{ weekday: number; openMinute: number; closeMinute: number }>;
  media: Array<{ id: string; alt: string | null; credit: string | null; license: string | null; width: number | null; height: number | null }>;
  translationsAvailable: string[];
}

const ONLINE_MS = 2 * 60_000;
const FALLBACK: Record<string, string[]> = { he: ["he", "yi", "en"], yi: ["yi", "he", "en"], en: ["en", "he"], fr: ["fr", "en", "he"], ru: ["ru", "en", "he"], es: ["es", "en", "he"], pt: ["pt", "en", "he"], de: ["de", "en", "he"] };

interface Loaded {
  graves: (typeof graves.$inferSelect)[];
  tr: (typeof graveTranslations.$inferSelect)[];
  loc: (typeof locations.$inferSelect)[];
  hil: (typeof graveHilulot.$inferSelect)[];
  sched: (typeof graveSchedules.$inferSelect)[];
  devs: Array<{ graveId: string; deviceId: string; status: string; lastSeenAt: Date | null; paused: boolean }>;
  media: (typeof graveMedia.$inferSelect)[];
  priceRows: (typeof prices.$inferSelect)[];
}

async function loadAll(filter?: { slugs?: string[]; ids?: string[]; includeUnpublished?: boolean }): Promise<Loaded> {
  const db = await getDb();
  const conds = [];
  if (filter?.slugs) conds.push(inArray(graves.slug, filter.slugs));
  if (filter?.ids) conds.push(inArray(graves.id, filter.ids));
  const gs = await db.select().from(graves).where(conds.length ? and(...conds) : undefined).orderBy(asc(graves.sortOrder));
  const visible = filter?.includeUnpublished ? gs : gs.filter((g) => g.publishedAt);
  const ids = visible.map((g) => g.id);
  if (!ids.length) return { graves: [], tr: [], loc: [], hil: [], sched: [], devs: [], media: [], priceRows: [] };
  const [tr, loc, hil, sched, devs, media, priceRows] = await Promise.all([
    db.select().from(graveTranslations).where(inArray(graveTranslations.graveId, ids)),
    db.select().from(locations).where(inArray(locations.id, visible.map((g) => g.locationId!).filter(Boolean))),
    db.select().from(graveHilulot).where(inArray(graveHilulot.graveId, ids)),
    db.select().from(graveSchedules).where(inArray(graveSchedules.graveId, ids)),
    db
      .select({ graveId: deviceAssignments.graveId, deviceId: devices.id, status: devices.status, lastSeenAt: devices.lastSeenAt, paused: devices.paused })
      .from(deviceAssignments)
      .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
      .where(and(inArray(deviceAssignments.graveId, ids), isNull(deviceAssignments.unassignedAt))),
    db.select().from(graveMedia).where(and(inArray(graveMedia.graveId, ids), eq(graveMedia.rightsVerified, true))).orderBy(asc(graveMedia.sortOrder), asc(graveMedia.createdAt)),
    db
      .select()
      .from(prices)
      .where(and(eq(prices.item, "kvittel"), lte(prices.validFrom, new Date()), or(isNull(prices.validTo), gt(prices.validTo, new Date())))),
  ]);
  return { graves: visible, tr, loc, hil, sched, devs, media, priceRows };
}

export function policyOf(g: typeof graves.$inferSelect, sched: Loaded["sched"]): GraveServicePolicy {
  return {
    timezone: g.timezone,
    observeShabbat: g.observeShabbat,
    observeYomTov: g.observeYomTov,
    israelHolidays: g.israelHolidays,
    shabbatCutoffMinute: g.shabbatCutoffMinute,
    schedules: sched.filter((s) => s.graveId === g.id),
  };
}

export function computeAvailability(g: typeof graves.$inferSelect, sched: Loaded["sched"], devs: Loaded["devs"], now = new Date()): Availability {
  if (g.status === "discovery_only" || g.status === "coming_soon" || g.status === "paused") return { kind: "not_purchasable", reason: g.status };
  const mine = devs.filter((d) => d.graveId === g.id && d.status !== "retired" && d.status !== "revoked");
  if (!mine.length) return { kind: "not_purchasable", reason: "no_device" };
  const policy = policyOf(g, sched);
  const next = nextOpenAt(policy, now);
  if (g.status === "maintenance") return { kind: "scheduled", reason: "maintenance", nextOpenAt: null };
  const closed = closedReason(policy, now);
  if (closed) return { kind: "scheduled", reason: closed, nextOpenAt: next?.toISOString() ?? null };
  const online = mine.some((d) => d.status === "active" && !d.paused && d.lastSeenAt && now.getTime() - d.lastSeenAt.getTime() < ONLINE_MS);
  if (!online) return { kind: "scheduled", reason: "device_offline", nextOpenAt: null };
  return { kind: "available_now" };
}

function pickTr(all: Loaded["tr"], graveId: string, locale: string) {
  const mine = all.filter((t) => t.graveId === graveId);
  for (const l of FALLBACK[locale] ?? [locale, "en", "he"]) {
    const t = mine.find((x) => x.locale === l);
    if (t) return t;
  }
  return mine[0];
}

function fromPriceFor(graveId: string, rows: Loaded["priceRows"], currency: string) {
  const override = rows.filter((r) => r.scope === "grave" && r.graveId === graveId && r.currency === currency).sort((a, b) => b.version - a.version)[0];
  const def = rows.filter((r) => r.scope === "default" && r.currency === currency).sort((a, b) => b.version - a.version)[0];
  const r = override ?? def;
  return r ? { amountMinor: r.amountMinor, currency } : null;
}

function toCard(L: Loaded, g: typeof graves.$inferSelect, locale: string, currency: string): GraveCardData {
  const t = pickTr(L.tr, g.id, locale);
  const he = L.tr.find((x) => x.graveId === g.id && x.locale === "he");
  const loc = L.loc.find((l) => l.id === g.locationId);
  const h = L.hil.find((x) => x.graveId === g.id);
  const next = h ? nextHilula(h.hebrewDay, h.hebrewMonth, h.hebrewYearOfPassing) : null;
  return {
    id: g.id,
    slug: g.slug,
    status: g.status,
    name: t?.name ?? g.slug,
    nameHe: he?.name ?? t?.name ?? g.slug,
    epithet: t?.epithet ?? null,
    place: t?.placeName ?? null,
    countryCode: loc?.countryCode ?? "",
    timezone: g.timezone,
    dynasty: g.dynasty,
    era: [g.eraStartYear, g.eraEndYear],
    featured: g.featured,
    isDemo: g.isDemo,
    translationLocale: t?.locale ?? locale,
    hilula: next && h ? { date: next.date.toISOString(), hebrewDay: h.hebrewDay, hebrewMonth: h.hebrewMonth, verified: h.verified } : null,
    availability: computeAvailability(g, L.sched, L.devs),
    fromPrice: fromPriceFor(g.id, L.priceRows, currency),
    hasMedia: L.media.some((m) => m.graveId === g.id),
    cover: (() => {
      const m = L.media.find((x) => x.graveId === g.id);
      return m ? { id: m.id, width: m.width, height: m.height, alt: (m.alt as Record<string, string> | null)?.[locale] ?? null } : null;
    })(),
  };
}

export async function listGraves(locale: string, currency: string): Promise<GraveCardData[]> {
  const L = await loadAll();
  return L.graves.map((g) => toCard(L, g, locale, currency));
}

export async function getGrave(slug: string, locale: string, currency: string, opts?: { includeUnpublished?: boolean }): Promise<GraveDetailData | null> {
  const L = await loadAll({ slugs: [slug], includeUnpublished: opts?.includeUnpublished });
  const g = L.graves[0];
  if (!g) return null;
  const db = await getDb();
  const aliases = await db.select({ alias: graveAliases.alias }).from(graveAliases).where(eq(graveAliases.graveId, g.id));
  const t = pickTr(L.tr, g.id, locale);
  const loc = L.loc.find((l) => l.id === g.locationId);
  return {
    ...toCard(L, g, locale, currency),
    bio: t?.bio ?? null,
    bioSources: t?.bioSources ?? null,
    customs: t?.customs ?? null,
    address: t?.address ?? null,
    metaTitle: t?.metaTitle ?? null,
    metaDescription: t?.metaDescription ?? null,
    faq: t?.faq ?? [],
    aliases: aliases.map((a) => a.alias),
    location: { lat: loc?.lat ?? null, lng: loc?.lng ?? null, verified: loc?.verified ?? false },
    schedules: L.sched.filter((s) => s.graveId === g.id).map((s) => ({ weekday: s.weekday, openMinute: s.openMinute, closeMinute: s.closeMinute })),
    media: L.media.filter((m) => m.graveId === g.id).map((m) => ({ id: m.id, alt: (m.alt as Record<string, string> | null)?.[locale] ?? null, credit: m.credit, license: m.license, width: m.width, height: m.height })),
    translationsAvailable: L.tr.filter((x) => x.graveId === g.id).map((x) => x.locale),
  };
}

export async function getGravesByIds(ids: string[], locale: string, currency: string) {
  const L = await loadAll({ ids });
  return L.graves.map((g) => toCard(L, g, locale, currency));
}

/* ───────────── search ───────────── */

interface IndexEntry {
  graveId: string;
  slug: string;
  norm: string;
  skeleton: string;
}
const gidx = globalThis as unknown as { __kvSearch?: { at: number; entries: IndexEntry[] } };

export function invalidateSearchIndex() {
  gidx.__kvSearch = undefined;
}

/** Latin consonant skeleton to match transliteration variants (Lizhensk / Lizensk / Leżajsk). */
export function latinSkeleton(s: string): string {
  return normalizeSearch(s)
    .replace(/sch|sh|zh|sz|cz|ch|kh|tz|ts|ż|ž|š/g, (m) => ({ sch: "s", sh: "s", zh: "s", sz: "s", cz: "c", ch: "h", kh: "h", tz: "c", ts: "c", ż: "s", ž: "s", š: "s" })[m] ?? m)
    .replace(/[aeiouyw'\s]/g, "")
    .replace(/z/g, "s")
    .replace(/k/g, "c")
    .replace(/(.)\1+/g, "$1");
}

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j]!;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length]!;
}

async function index(): Promise<IndexEntry[]> {
  if (gidx.__kvSearch && Date.now() - gidx.__kvSearch.at < 5 * 60000) return gidx.__kvSearch.entries;
  const db = await getDb();
  const rows = await db
    .select({ graveId: graveAliases.graveId, alias: graveAliases.alias, slug: graves.slug, published: graves.publishedAt })
    .from(graveAliases)
    .innerJoin(graves, eq(graves.id, graveAliases.graveId));
  const tr = await db.select({ graveId: graveTranslations.graveId, place: graveTranslations.placeName, slug: graves.slug, published: graves.publishedAt }).from(graveTranslations).innerJoin(graves, eq(graves.id, graveTranslations.graveId));
  const entries: IndexEntry[] = [];
  for (const r of rows) if (r.published) entries.push({ graveId: r.graveId, slug: r.slug, norm: normalizeSearch(r.alias), skeleton: latinSkeleton(r.alias) });
  for (const r of tr) if (r.published && r.place) entries.push({ graveId: r.graveId, slug: r.slug, norm: normalizeSearch(r.place), skeleton: latinSkeleton(r.place) });
  gidx.__kvSearch = { at: Date.now(), entries };
  return entries;
}

export async function searchGraveIds(q: string): Promise<Array<{ graveId: string; score: number }>> {
  const nq = normalizeSearch(q);
  if (!nq) return [];
  const sq = latinSkeleton(q);
  const tokens = nq.split(" ").filter((t) => t.length > 1);
  const scores = new Map<string, number>();
  for (const e of await index()) {
    let s = 0;
    if (e.norm === nq) s = 100;
    else if (e.norm.startsWith(nq)) s = 80;
    else if (e.norm.includes(nq)) s = 65;
    else if (sq.length >= 3 && e.skeleton.includes(sq)) s = 55;
    else {
      const words = e.norm.split(" ");
      let hits = 0;
      for (const t of tokens) {
        if (words.some((w) => w.startsWith(t))) hits += 1;
        else if (t.length >= 4 && words.some((w) => lev(w, t) <= (t.length >= 7 ? 2 : 1))) hits += 0.7;
      }
      if (tokens.length && hits) s = Math.round((hits / tokens.length) * 50);
    }
    if (s > (scores.get(e.graveId) ?? 0)) scores.set(e.graveId, s);
  }
  return [...scores.entries()]
    .filter(([, s]) => s >= 25)
    .sort((a, b) => b[1] - a[1])
    .map(([graveId, score]) => ({ graveId, score }));
}

export async function searchGraves(q: string, locale: string, currency: string): Promise<GraveCardData[]> {
  const hits = await searchGraveIds(q);
  if (!hits.length) return [];
  const cards = await getGravesByIds(hits.map((h) => h.graveId), locale, currency);
  const order = new Map(hits.map((h, i) => [h.graveId, i]));
  return cards.sort((a, b) => order.get(a.id)! - order.get(b.id)!);
}

export async function recentlyActivated(limit = 3) {
  const db = await getDb();
  return db.select({ id: graves.id }).from(graves).where(eq(graves.status, "active")).orderBy(desc(graves.publishedAt)).limit(limit);
}

/** Graves for the builder, with the printed-name candidates in every language. */
export async function builderGraves(locale: string, currency: string) {
  const cards = await listGraves(locale, currency);
  const db = await getDb();
  const tr = cards.length ? await db.select({ graveId: graveTranslations.graveId, locale: graveTranslations.locale, name: graveTranslations.name }).from(graveTranslations).where(inArray(graveTranslations.graveId, cards.map((c) => c.id))) : [];
  return cards.map((c) => ({
    slug: c.slug,
    name: c.name,
    nameHe: c.nameHe,
    namesByLocale: Object.fromEntries(tr.filter((x) => x.graveId === c.id).map((x) => [x.locale, x.name])),
    place: c.place,
    availability: c.availability,
    fromPrice: c.fromPrice,
  }));
}
