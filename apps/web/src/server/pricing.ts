import "server-only";
import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { coupons, graves, prices } from "@kvittel/db";
import { getDb } from "./db";

export interface QuoteLine {
  entryId: string;
  graveId: string;
  graveSlug: string;
  pages: number;
  unitMinor: number;
  extrasMinor: number;
  discountMinor: number;
  totalMinor: number;
  priceRowIds: string[];
}

export interface Quote {
  currency: string;
  lines: QuoteLine[];
  subtotalMinor: number;
  bundleDiscountMinor: number;
  couponDiscountMinor: number;
  totalMinor: number;
  coupon: { id: string; code: string } | null;
  couponError: "invalid" | "expired" | "exhausted" | "currency" | null;
  bundleBps: number;
}

async function activePrices(currency: string) {
  const db = await getDb();
  const now = new Date();
  return db
    .select()
    .from(prices)
    .where(and(inArray(prices.currency, [currency, "ANY"]), lte(prices.validFrom, now), or(isNull(prices.validTo), gt(prices.validTo, now))));
}

/**
 * Server-authoritative quote. The client never supplies amounts.
 * Bundle discount applies when one order contains ≥2 grave deliveries.
 */
export async function quote(currency: string, items: Array<{ entryId: string; graveSlug: string; pages: number }>, couponCode?: string): Promise<Quote> {
  const db = await getDb();
  const rows = await activePrices(currency);
  const slugs = [...new Set(items.map((i) => i.graveSlug))];
  const gs = slugs.length ? await db.select({ id: graves.id, slug: graves.slug }).from(graves).where(inArray(graves.slug, slugs)) : [];
  const pick = (item: string, graveId?: string) => {
    const o = graveId ? rows.filter((r) => r.scope === "grave" && r.graveId === graveId && r.item === item).sort((a, b) => b.version - a.version)[0] : undefined;
    return o ?? rows.filter((r) => r.scope === "default" && r.item === item).sort((a, b) => b.version - a.version)[0];
  };
  const bundleRow = pick("bundle_discount_bps");
  const bundleBps = items.length >= 2 ? (bundleRow?.amountMinor ?? 0) : 0;
  const lines: QuoteLine[] = [];
  for (const it of items) {
    const g = gs.find((x) => x.slug === it.graveSlug);
    if (!g) throw new Error(`unknown grave ${it.graveSlug}`);
    const unit = pick("kvittel", g.id);
    const extra = pick("extra_page", g.id);
    if (!unit) throw new Error(`no price for ${currency}`);
    const extrasMinor = Math.max(0, it.pages - 1) * (extra?.amountMinor ?? 0);
    const gross = unit.amountMinor + extrasMinor;
    const discountMinor = Math.round((gross * bundleBps) / 10000);
    lines.push({ entryId: it.entryId, graveId: g.id, graveSlug: g.slug, pages: it.pages, unitMinor: unit.amountMinor, extrasMinor, discountMinor, totalMinor: gross - discountMinor, priceRowIds: [unit.id, extra?.id, bundleBps ? bundleRow?.id : undefined].filter(Boolean) as string[] });
  }
  const subtotalMinor = lines.reduce((s, l) => s + l.unitMinor + l.extrasMinor, 0);
  const bundleDiscountMinor = lines.reduce((s, l) => s + l.discountMinor, 0);
  let couponDiscountMinor = 0;
  let coupon: Quote["coupon"] = null;
  let couponError: Quote["couponError"] = null;
  if (couponCode?.trim()) {
    const [c] = await db.select().from(coupons).where(eq(coupons.code, couponCode.trim().toUpperCase())).limit(1);
    const now = new Date();
    if (!c || !c.active) couponError = "invalid";
    else if ((c.validFrom && c.validFrom > now) || (c.validTo && c.validTo < now)) couponError = "expired";
    else if (c.maxRedemptions !== null && c.redeemedCount >= c.maxRedemptions) couponError = "exhausted";
    else if (c.kind === "fixed" && c.currency !== currency) couponError = "currency";
    else {
      const base = subtotalMinor - bundleDiscountMinor;
      couponDiscountMinor = c.kind === "percent" ? Math.round((base * c.value) / 10000) : Math.min(base, c.value);
      coupon = { id: c.id, code: c.code };
    }
  }
  const totalMinor = Math.max(0, subtotalMinor - bundleDiscountMinor - couponDiscountMinor);
  return { currency, lines, subtotalMinor, bundleDiscountMinor, couponDiscountMinor, totalMinor, coupon, couponError, bundleBps };
}
