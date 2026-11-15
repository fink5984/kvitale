"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  coupons,
  featureFlags,
  graveAliases,
  graveHilulot,
  graveMedia,
  graves,
  graveSchedules,
  graveTranslations,
  kvittels,
  locations,
  normalizeSearch,
  openSealed,
  orderItems,
  orders,
  pages,
  pageTranslations,
  partnerGraves,
  partners,
  payments,
  prices,
  printJobs,
  refunds,
  roleAssignments,
  scriptOf,
  users,
} from "@kvittel/db";
import type { KvittelContent } from "@kvittel/print-layout";
import { audit } from "@/server/audit";
import { requirePermission } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { sendOrderConfirmation } from "@/server/email";
import { env } from "@/server/env";
import { invalidateSearchIndex } from "@/server/graves";
import { providerById } from "@/server/payments";
import { renderServer } from "@/server/print";
import { recomputeOrderStatus, resolveUncertain } from "@/server/queue";
import { ROLES, type Role } from "@/server/rbac";
import { storage } from "@/server/storage";
import { formatMoney } from "@/lib/format";
import { randomToken, sha256, orderTrackingTokens } from "@kvittel/db";

const reasonSchema = z.string().trim().min(4).max(500);
type Result = { ok: true; message?: string } | { ok: false; error: string };

/* ───────────── orders ───────────── */

export async function adminResolveJob(jobId: string, decision: "delivered" | "requeue" | "failed", reason: string): Promise<Result> {
  const u = await requirePermission("orders.manage");
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: "reason_required" };
  const ok = await resolveUncertain(jobId, decision, u.id, reason);
  revalidatePath("/[locale]/admin/orders", "layout");
  return ok ? { ok: true } : { ok: false, error: "not_resolvable" };
}

export async function adminRequestRefund(orderItemId: string, reason: string): Promise<Result> {
  const u = await requirePermission("orders.refund.request");
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: "reason_required" };
  const db = await getDb();
  const [it] = await db.select().from(orderItems).where(eq(orderItems.id, orderItemId));
  if (!it || it.status === "refunded") return { ok: false, error: "not_refundable" };
  if (it.status === "delivered") return { ok: false, error: "already_delivered" };
  const [pay] = await db.select().from(payments).where(and(eq(payments.orderId, it.orderId), eq(payments.status, "succeeded")));
  if (!pay) return { ok: false, error: "no_payment" };
  const [r] = await db.insert(refunds).values({ paymentId: pay.id, orderItemId: it.id, amountMinor: it.totalMinor, currency: pay.currency, reason, requestedBy: u.id }).returning();
  await audit({ actorUserId: u.id, action: "refund.requested", targetType: "order", targetId: it.orderId, reason, meta: { refundId: r!.id, amount: it.totalMinor } });
  revalidatePath("/[locale]/admin/orders", "layout");
  return { ok: true };
}

/** Four-eyes: approval by finance. Cancels the print job if it has not started. */
export async function adminApproveRefund(refundId: string): Promise<Result> {
  const u = await requirePermission("orders.refund.approve");
  const db = await getDb();
  const [r] = await db.select().from(refunds).where(eq(refunds.id, refundId));
  if (!r || r.status !== "requested") return { ok: false, error: "not_pending" };
  if (r.requestedBy === u.id && !u.roles.includes("super_admin")) return { ok: false, error: "four_eyes" };
  const [pay] = await db.select().from(payments).where(eq(payments.id, r.paymentId));
  const provider = providerById(pay!.provider);
  if (!provider) return { ok: false, error: "provider_unavailable" };
  if (r.orderItemId) {
    const [job] = await db.select().from(printJobs).where(eq(printJobs.orderItemId, r.orderItemId));
    if (job && ["leased", "printing", "printed", "cut"].includes(job.status)) return { ok: false, error: "job_in_flight" };
    if (job && !["delivered"].includes(job.status)) await db.update(printJobs).set({ status: "canceled", updatedAt: new Date() }).where(eq(printJobs.id, job.id));
  }
  const res = await provider.refund(pay!.providerRef, r.amountMinor, r.currency);
  if (!res.ok) {
    await db.update(refunds).set({ status: "failed", approvedBy: u.id }).where(eq(refunds.id, r.id));
    return { ok: false, error: res.error ?? "provider_failed" };
  }
  await db.update(refunds).set({ status: "succeeded", approvedBy: u.id, providerRef: res.refundRef }).where(eq(refunds.id, r.id));
  const refunded = pay!.refundedMinor + r.amountMinor;
  await db.update(payments).set({ refundedMinor: refunded, status: refunded >= pay!.amountMinor ? "refunded" : "partially_refunded" }).where(eq(payments.id, pay!.id));
  if (r.orderItemId) await db.update(orderItems).set({ status: "refunded" }).where(eq(orderItems.id, r.orderItemId));
  await recomputeOrderStatus(pay!.orderId);
  await audit({ actorUserId: u.id, action: "refund.approved", targetType: "order", targetId: pay!.orderId, meta: { refundId: r.id, amount: r.amountMinor, provider: pay!.provider } });
  revalidatePath("/[locale]/admin/orders", "layout");
  return { ok: true };
}

export async function adminResendConfirmation(orderId: string): Promise<Result> {
  const u = await requirePermission("orders.manage");
  const db = await getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o || !o.paidAt) return { ok: false, error: "not_paid" };
  const token = randomToken(24);
  await db.insert(orderTrackingTokens).values({ orderId: o.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 120 * 86400000) });
  await sendOrderConfirmation(o.email, o.locale, { ref: o.publicRef, trackUrl: `${env.appUrl}/${o.locale}/order/${o.publicRef}?t=${token}`, total: formatMoney(o.totalMinor, o.currency, o.locale), graves: [], scheduled: false });
  await audit({ actorUserId: u.id, action: "order.confirmation_resent", targetType: "order", targetId: o.id });
  return { ok: true };
}

/**
 * Break-glass content view: requires kvittel.content.read AND a business reason.
 * Returns a rendered image of the slip (as printed), never editable text.
 */
export async function adminRevealKvittel(orderItemId: string, reason: string): Promise<{ ok: true; images: string[] } | { ok: false; error: string }> {
  const u = await requirePermission("kvittel.content.read");
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: "reason_required" };
  const db = await getDb();
  const [row] = await db.select({ k: kvittels, it: orderItems }).from(orderItems).innerJoin(kvittels, eq(kvittels.id, orderItems.kvittelId)).where(eq(orderItems.id, orderItemId));
  if (!row) return { ok: false, error: "not_found" };
  await audit({ actorUserId: u.id, action: "kvittel.content.revealed", targetType: "order", targetId: row.it.orderId, reason, meta: { orderItemId } });
  if (!row.k.contentEnc) return { ok: false, error: "purged" };
  const content = JSON.parse(openSealed(row.k.contentEnc).toString("utf8")) as KvittelContent;
  const r = await renderServer(content);
  return { ok: true, images: r.pngs.map((p) => `data:image/png;base64,${p.toString("base64")}`) };
}

/* ───────────── graves CMS ───────────── */

const graveSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().regex(/^[a-z0-9-]{2,60}$/),
  status: z.enum(["discovery_only", "coming_soon", "active", "paused", "maintenance"]),
  timezone: z.string().min(3).max(60),
  countryCode: z.string().length(2).toUpperCase(),
  cityKey: z.string().trim().min(2).max(60),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  locationVerified: z.boolean(),
  verificationSource: z.string().max(300).optional(),
  dynasty: z.string().max(40).optional(),
  eraStartYear: z.number().int().min(0).max(2100).nullable(),
  eraEndYear: z.number().int().min(0).max(2100).nullable(),
  featured: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
  permitStatus: z.enum(["none", "requested", "approved", "revoked"]),
  permitNotes: z.string().max(1000).optional(),
  observeShabbat: z.boolean(),
  observeYomTov: z.boolean(),
  israelHolidays: z.boolean(),
  shabbatCutoffMinute: z.number().int().min(0).max(1439),
  published: z.boolean(),
  translations: z.array(z.object({ locale: z.string().min(2).max(5), name: z.string().trim().max(160), epithet: z.string().max(200).optional(), placeName: z.string().max(200).optional(), address: z.string().max(300).optional(), bio: z.string().max(5000).optional(), bioSources: z.string().max(1000).optional(), customs: z.string().max(2000).optional(), metaTitle: z.string().max(70).optional(), metaDescription: z.string().max(170).optional(), reviewed: z.boolean() })),
  aliases: z.array(z.string().trim().min(1).max(120)).max(60),
  schedules: z.array(z.object({ weekday: z.number().int().min(0).max(6), openMinute: z.number().int().min(0).max(1440), closeMinute: z.number().int().min(0).max(1440) })).max(21),
  hilula: z.object({ day: z.number().int().min(1).max(30), month: z.number().int().min(1).max(13), year: z.number().int().min(3000).max(6000).nullable(), verified: z.boolean(), sourceNote: z.string().max(300).optional() }).nullable(),
});
export type GraveInput = z.infer<typeof graveSchema>;

export async function adminSaveGrave(input: GraveInput): Promise<Result & { id?: string }> {
  const u = await requirePermission("graves.write");
  const p = graveSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const g = p.data;
  if (g.published && !u.permissions.has("graves.publish")) return { ok: false, error: "publish_not_permitted" };
  if (g.status === "active" && g.permitStatus !== "approved") return { ok: false, error: "active_requires_permit" };
  if (g.published && !g.translations.some((t) => t.name.trim())) return { ok: false, error: "name_required" };
  try { new Intl.DateTimeFormat("en", { timeZone: g.timezone }); } catch { return { ok: false, error: "invalid_timezone" }; }
  const db = await getDb();
  const id = await db.transaction(async (tx) => {
    let graveId = g.id;
    let locationId: string | null = null;
    if (graveId) {
      const [cur] = await tx.select().from(graves).where(eq(graves.id, graveId));
      locationId = cur?.locationId ?? null;
    }
    const loc = { countryCode: g.countryCode, cityKey: g.cityKey, lat: g.lat, lng: g.lng, verified: g.locationVerified && g.lat !== null, verificationSource: g.verificationSource || null };
    if (locationId) await tx.update(locations).set(loc).where(eq(locations.id, locationId));
    else locationId = (await tx.insert(locations).values(loc).returning())[0]!.id;
    const values = {
      slug: g.slug, status: g.status, locationId, timezone: g.timezone, dynasty: g.dynasty || null, eraStartYear: g.eraStartYear, eraEndYear: g.eraEndYear, featured: g.featured, sortOrder: g.sortOrder, permitStatus: g.permitStatus, permitNotes: g.permitNotes || null,
      observeShabbat: g.observeShabbat, observeYomTov: g.observeYomTov, israelHolidays: g.israelHolidays, shabbatCutoffMinute: g.shabbatCutoffMinute, updatedAt: new Date(),
    };
    if (graveId) {
      const [cur] = await tx.select({ publishedAt: graves.publishedAt }).from(graves).where(eq(graves.id, graveId));
      await tx.update(graves).set({ ...values, publishedAt: g.published ? (cur?.publishedAt ?? new Date()) : null }).where(eq(graves.id, graveId));
    } else {
      graveId = (await tx.insert(graves).values({ ...values, publishedAt: g.published ? new Date() : null }).returning())[0]!.id;
    }
    for (const t of g.translations) {
      if (!t.name.trim()) {
        await tx.delete(graveTranslations).where(and(eq(graveTranslations.graveId, graveId), eq(graveTranslations.locale, t.locale)));
        continue;
      }
      const v = { name: t.name, epithet: t.epithet || null, placeName: t.placeName || null, address: t.address || null, bio: t.bio || null, bioSources: t.bioSources || null, customs: t.customs || null, metaTitle: t.metaTitle || null, metaDescription: t.metaDescription || null, reviewed: t.reviewed, updatedAt: new Date() };
      await tx.insert(graveTranslations).values({ graveId, locale: t.locale, ...v }).onConflictDoUpdate({ target: [graveTranslations.graveId, graveTranslations.locale], set: v });
    }
    await tx.delete(graveAliases).where(eq(graveAliases.graveId, graveId));
    const all = new Set([...g.aliases, ...g.translations.map((t) => t.name).filter(Boolean)]);
    if (all.size) await tx.insert(graveAliases).values([...all].map((a) => ({ graveId: graveId!, alias: a, script: scriptOf(a), normalized: normalizeSearch(a) })));
    await tx.delete(graveSchedules).where(eq(graveSchedules.graveId, graveId));
    if (g.schedules.length) await tx.insert(graveSchedules).values(g.schedules.filter((s) => s.closeMinute > s.openMinute).map((s) => ({ ...s, graveId: graveId! })));
    await tx.delete(graveHilulot).where(eq(graveHilulot.graveId, graveId));
    if (g.hilula) await tx.insert(graveHilulot).values({ graveId, hebrewDay: g.hilula.day, hebrewMonth: g.hilula.month, hebrewYearOfPassing: g.hilula.year, verified: g.hilula.verified, sourceNote: g.hilula.sourceNote || null });
    return graveId;
  });
  invalidateSearchIndex();
  await audit({ actorUserId: u.id, action: g.id ? "grave.updated" : "grave.created", targetType: "grave", targetId: id, meta: { slug: g.slug, status: g.status, published: g.published } });
  revalidatePath("/[locale]/admin/graves", "layout");
  return { ok: true, id };
}

export async function adminUploadGraveMedia(form: FormData): Promise<Result> {
  const u = await requirePermission("graves.write");
  const graveId = String(form.get("graveId") ?? "");
  const file = form.get("file");
  const credit = String(form.get("credit") ?? "").slice(0, 200);
  const license = String(form.get("license") ?? "").slice(0, 200);
  const rights = form.get("rightsVerified") === "on";
  if (!(file instanceof Blob) || file.size > 10 * 1024 * 1024) return { ok: false, error: "invalid_file" };
  if (!z.string().uuid().safeParse(graveId).success) return { ok: false, error: "invalid" };
  const { sanitizePhoto } = await import("@kvittel/print-layout/node");
  let clean;
  try {
    clean = await sanitizePhoto(Buffer.from(await file.arrayBuffer()));
  } catch {
    return { ok: false, error: "decode_failed" };
  }
  const key = `media/${graveId}/${randomToken(10).replace(/[^A-Za-z0-9_-]/g, "")}`;
  await storage.put(key, clean.data);
  const db = await getDb();
  const existing = await db.select({ sortOrder: graveMedia.sortOrder }).from(graveMedia).where(eq(graveMedia.graveId, graveId));
  const sortOrder = existing.length ? Math.max(...existing.map((e) => e.sortOrder)) + 1 : 0;
  await db.insert(graveMedia).values({ graveId, storageKey: key, mime: clean.mime, width: clean.width, height: clean.height, credit: credit || null, license: license || null, rightsVerified: rights && !!credit && !!license, sortOrder });
  await audit({ actorUserId: u.id, action: "grave.media.uploaded", targetType: "grave", targetId: graveId, meta: { rightsVerified: rights && !!credit && !!license } });
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

/** Edit credit/licence and the rights confirmation. Public display requires all three. */
export async function adminUpdateGraveMedia(input: { id: string; credit: string; license: string; rightsVerified: boolean }): Promise<Result> {
  const u = await requirePermission("graves.write");
  const p = z.object({ id: z.string().uuid(), credit: z.string().trim().max(200), license: z.string().trim().max(200), rightsVerified: z.boolean() }).safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  if (p.data.rightsVerified && (!p.data.credit || !p.data.license)) return { ok: false, error: "credit_license_required" };
  const db = await getDb();
  const [m] = await db.update(graveMedia).set({ credit: p.data.credit || null, license: p.data.license || null, rightsVerified: p.data.rightsVerified }).where(eq(graveMedia.id, p.data.id)).returning({ graveId: graveMedia.graveId });
  if (!m) return { ok: false, error: "not_found" };
  await audit({ actorUserId: u.id, action: "grave.media.updated", targetType: "grave", targetId: m.graveId, meta: { mediaId: p.data.id, rightsVerified: p.data.rightsVerified } });
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

/** Make a photo the cover (first in order). */
export async function adminSetGraveCover(id: string): Promise<Result> {
  const u = await requirePermission("graves.write");
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const db = await getDb();
  const [m] = await db.select().from(graveMedia).where(eq(graveMedia.id, id));
  if (!m) return { ok: false, error: "not_found" };
  const all = await db.select({ id: graveMedia.id, sortOrder: graveMedia.sortOrder }).from(graveMedia).where(eq(graveMedia.graveId, m.graveId));
  const ordered = [m.id, ...all.sort((a, b) => a.sortOrder - b.sortOrder).map((x) => x.id).filter((x) => x !== m.id)];
  for (const [i, mid] of ordered.entries()) await db.update(graveMedia).set({ sortOrder: i }).where(eq(graveMedia.id, mid));
  await audit({ actorUserId: u.id, action: "grave.media.cover", targetType: "grave", targetId: m.graveId, meta: { mediaId: id } });
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

export async function adminDeleteGraveMedia(id: string): Promise<Result> {
  const u = await requirePermission("graves.write");
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "invalid" };
  const db = await getDb();
  const [m] = await db.delete(graveMedia).where(eq(graveMedia.id, id)).returning();
  if (!m) return { ok: false, error: "not_found" };
  await storage.remove(m.storageKey);
  await audit({ actorUserId: u.id, action: "grave.media.deleted", targetType: "grave", targetId: m.graveId, meta: { mediaId: id } });
  revalidatePath("/[locale]", "layout");
  return { ok: true };
}

/* ───────────── pricing ───────────── */

export async function adminSetPrice(input: { scope: "default" | "grave"; graveId?: string; item: "kvittel" | "extra_page"; currency: string; amountMinor: number }): Promise<Result> {
  const u = await requirePermission("pricing.write");
  const p = z.object({ scope: z.enum(["default", "grave"]), graveId: z.string().uuid().optional(), item: z.enum(["kvittel", "extra_page"]), currency: z.enum(["USD", "EUR", "ILS", "GBP", "CAD", "AUD"]), amountMinor: z.number().int().min(0).max(1_000_000) }).safeParse(input);
  if (!p.success || (p.data.scope === "grave" && !p.data.graveId)) return { ok: false, error: "invalid" };
  const db = await getDb();
  const now = new Date();
  const where = and(eq(prices.scope, p.data.scope), eq(prices.item, p.data.item), eq(prices.currency, p.data.currency), isNull(prices.validTo), p.data.graveId ? eq(prices.graveId, p.data.graveId) : isNull(prices.graveId));
  const cur = await db.select().from(prices).where(where);
  const version = Math.max(0, ...cur.map((c) => c.version)) + 1;
  await db.update(prices).set({ validTo: now }).where(where);
  await db.insert(prices).values({ ...p.data, graveId: p.data.graveId ?? null, version, validFrom: now, createdBy: u.id });
  await audit({ actorUserId: u.id, action: "price.changed", targetType: "price", targetId: `${p.data.scope}:${p.data.item}:${p.data.currency}`, meta: { from: cur[0]?.amountMinor ?? null, to: p.data.amountMinor, version } });
  revalidatePath("/[locale]/admin/pricing", "layout");
  return { ok: true };
}

export async function adminRemoveOverride(priceId: string): Promise<Result> {
  const u = await requirePermission("pricing.write");
  const db = await getDb();
  await db.update(prices).set({ validTo: new Date() }).where(and(eq(prices.id, priceId), eq(prices.scope, "grave")));
  await audit({ actorUserId: u.id, action: "price.override_ended", targetType: "price", targetId: priceId });
  revalidatePath("/[locale]/admin/pricing", "layout");
  return { ok: true };
}

export async function adminSetBundle(bps: number): Promise<Result> {
  const u = await requirePermission("pricing.write");
  if (!Number.isInteger(bps) || bps < 0 || bps > 5000) return { ok: false, error: "invalid" };
  const db = await getDb();
  const now = new Date();
  await db.update(prices).set({ validTo: now }).where(and(eq(prices.item, "bundle_discount_bps"), isNull(prices.validTo)));
  await db.insert(prices).values({ scope: "default", item: "bundle_discount_bps", currency: "ANY", amountMinor: bps, validFrom: now, createdBy: u.id });
  await audit({ actorUserId: u.id, action: "price.bundle_changed", meta: { bps } });
  revalidatePath("/[locale]/admin/pricing", "layout");
  return { ok: true };
}

export async function adminSaveCoupon(input: { code: string; kind: "percent" | "fixed"; value: number; currency?: string; maxRedemptions?: number | null; validTo?: string | null; active: boolean }): Promise<Result> {
  const u = await requirePermission("pricing.write");
  const p = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/), kind: z.enum(["percent", "fixed"]), value: z.number().int().min(1).max(1_000_000), currency: z.string().length(3).optional(), maxRedemptions: z.number().int().min(1).nullable().optional(), validTo: z.string().nullable().optional(), active: z.boolean() }).safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  if (p.data.kind === "percent" && p.data.value > 10000) return { ok: false, error: "invalid" };
  if (p.data.kind === "fixed" && !p.data.currency) return { ok: false, error: "currency_required" };
  const db = await getDb();
  const v = { kind: p.data.kind, value: p.data.value, currency: p.data.kind === "fixed" ? p.data.currency! : null, maxRedemptions: p.data.maxRedemptions ?? null, validTo: p.data.validTo ? new Date(p.data.validTo) : null, active: p.data.active };
  await db.insert(coupons).values({ code: p.data.code, ...v }).onConflictDoUpdate({ target: coupons.code, set: v });
  await audit({ actorUserId: u.id, action: "coupon.saved", targetType: "coupon", targetId: p.data.code, meta: v });
  revalidatePath("/[locale]/admin/pricing", "layout");
  return { ok: true };
}

/* ───────────── content ───────────── */

export async function adminSavePage(input: { slug: string; locale: string; title: string; body: string; reviewed: boolean }): Promise<Result> {
  const u = await requirePermission("content.write");
  const p = z.object({ slug: z.string().regex(/^[a-z0-9-]{2,60}$/), locale: z.string().min(2).max(5), title: z.string().trim().min(1).max(200), body: z.string().max(30000), reviewed: z.boolean() }).safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const db = await getDb();
  let [pg] = await db.select().from(pages).where(eq(pages.slug, p.data.slug));
  if (!pg) [pg] = await db.insert(pages).values({ slug: p.data.slug, kind: "legal", published: true }).returning();
  const v = { title: p.data.title, body: p.data.body, reviewed: p.data.reviewed };
  await db.insert(pageTranslations).values({ pageId: pg!.id, locale: p.data.locale, ...v }).onConflictDoUpdate({ target: [pageTranslations.pageId, pageTranslations.locale], set: v });
  await audit({ actorUserId: u.id, action: "page.saved", targetType: "page", targetId: p.data.slug, meta: { locale: p.data.locale, reviewed: p.data.reviewed } });
  revalidatePath("/[locale]/admin/content", "layout");
  return { ok: true };
}

/* ───────────── settings ───────────── */

export async function adminToggleFlag(key: string, enabled: boolean): Promise<Result> {
  const u = await requirePermission("flags.write");
  const db = await getDb();
  await db.update(featureFlags).set({ enabled, updatedBy: u.id, updatedAt: new Date() }).where(eq(featureFlags.key, key));
  await audit({ actorUserId: u.id, action: "flag.toggled", targetType: "feature_flag", targetId: key, meta: { enabled } });
  revalidatePath("/[locale]/admin/settings", "layout");
  return { ok: true };
}

export async function adminGrantRole(input: { email: string; role: string; partnerId?: string | null }): Promise<Result> {
  const u = await requirePermission("roles.write");
  if (!(ROLES as readonly string[]).includes(input.role)) return { ok: false, error: "invalid_role" };
  const role = input.role as Role;
  if ((role === "partner_manager" || role === "local_maintainer") && !input.partnerId) return { ok: false, error: "partner_required" };
  const db = await getDb();
  const email = input.email.trim().toLowerCase();
  let [usr] = await db.select().from(users).where(eq(users.email, email));
  if (!usr) [usr] = await db.insert(users).values({ email }).returning();
  await db.insert(roleAssignments).values({ userId: usr!.id, role, partnerId: input.partnerId ?? null, grantedBy: u.id });
  await audit({ actorUserId: u.id, action: "role.granted", targetType: "user", targetId: usr!.id, meta: { role, partnerId: input.partnerId ?? null } });
  revalidatePath("/[locale]/admin/settings", "layout");
  return { ok: true };
}

export async function adminRevokeRole(assignmentId: string): Promise<Result> {
  const u = await requirePermission("roles.write");
  const db = await getDb();
  const [ra] = await db.update(roleAssignments).set({ revokedAt: new Date() }).where(eq(roleAssignments.id, assignmentId)).returning();
  await audit({ actorUserId: u.id, action: "role.revoked", targetType: "user", targetId: ra?.userId, meta: { role: ra?.role } });
  revalidatePath("/[locale]/admin/settings", "layout");
  return { ok: true };
}

/* ───────────── partners ───────────── */

export async function adminSavePartner(input: { name: string; kind: string; contactEmail?: string; locale: string; graveIds: string[] }): Promise<Result> {
  const u = await requirePermission("partners.manage");
  const p = z.object({ name: z.string().trim().min(2).max(120), kind: z.enum(["operator", "technician", "institution"]), contactEmail: z.email().optional().or(z.literal("")), locale: z.string().min(2).max(5), graveIds: z.array(z.string().uuid()).max(200) }).safeParse(input);
  if (!p.success) return { ok: false, error: "invalid" };
  const db = await getDb();
  const [pt] = await db.insert(partners).values({ name: p.data.name, kind: p.data.kind, contactEmail: p.data.contactEmail || null, locale: p.data.locale }).returning();
  if (p.data.graveIds.length) await db.insert(partnerGraves).values(p.data.graveIds.map((g) => ({ partnerId: pt!.id, graveId: g })));
  await audit({ actorUserId: u.id, action: "partner.created", targetType: "partner", targetId: pt!.id });
  revalidatePath("/[locale]/admin/partners", "layout");
  return { ok: true };
}

export async function adminSetPartnerGraves(partnerId: string, graveIds: string[]): Promise<Result> {
  const u = await requirePermission("partners.manage");
  const db = await getDb();
  await db.delete(partnerGraves).where(eq(partnerGraves.partnerId, partnerId));
  const valid = graveIds.length ? await db.select({ id: graves.id }).from(graves).where(inArray(graves.id, graveIds)) : [];
  if (valid.length) await db.insert(partnerGraves).values(valid.map((g) => ({ partnerId, graveId: g.id })));
  await audit({ actorUserId: u.id, action: "partner.scope_changed", targetType: "partner", targetId: partnerId, meta: { graves: valid.length } });
  revalidatePath("/[locale]/admin/partners", "layout");
  return { ok: true };
}

/* ───────────── customers ───────────── */

/** Anonymise a guest/customer: email replaced, content purged; financial rows remain (amounts only). */
export async function adminAnonymizeCustomer(email: string, reason: string): Promise<Result> {
  const u = await requirePermission("customers.manage");
  if (!reasonSchema.safeParse(reason).success) return { ok: false, error: "reason_required" };
  const db = await getDb();
  const e = email.trim().toLowerCase();
  const os = await db.select({ id: orders.id }).from(orders).where(eq(orders.email, e));
  const placeholder = `anon+${sha256(e).slice(0, 12)}@invalid`;
  if (os.length) {
    const its = await db.select({ k: orderItems.kvittelId }).from(orderItems).where(inArray(orderItems.orderId, os.map((o) => o.id)));
    if (its.length) await db.update(kvittels).set({ contentEnc: null, purgedAt: new Date() }).where(inArray(kvittels.id, its.map((i) => i.k)));
    await db.update(orders).set({ email: placeholder, marketingConsent: false }).where(eq(orders.email, e));
  }
  await db.update(users).set({ email: placeholder, displayName: null, deletedAt: new Date() }).where(eq(users.email, e));
  await audit({ actorUserId: u.id, action: "customer.anonymized", targetType: "customer", targetId: sha256(e).slice(0, 16), reason, meta: { orders: os.length } });
  revalidatePath("/[locale]/admin/customers", "layout");
  return { ok: true, message: placeholder };
}

