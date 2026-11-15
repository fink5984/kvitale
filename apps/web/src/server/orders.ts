import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  coupons,
  graves,
  graveSchedules,
  graveTranslations,
  kvittelFiles,
  kvittels,
  orderItems,
  orders,
  orderTrackingTokens,
  paymentEvents,
  payments,
  printAttempts,
  printJobs,
  randomToken,
  seal,
  sha256,
  userConsents,
  deviceAssignments,
  devices,
} from "@kvittel/db";
import type { KvittelContent } from "@kvittel/print-layout";
import { cookies } from "next/headers";
import type { CheckoutInput } from "@/lib/kvittel-schema";
import { formatMoney } from "@/lib/format";
import { audit } from "./audit";
import { getDb } from "./db";
import { env } from "./env";
import { computeAvailability, policyOf } from "./graves";
import { log } from "./log";
import { activeProvider } from "./payments";
import type { VerifiedEvent } from "./payments/types";
import { quote } from "./pricing";
import { renderServer } from "./print";
import { nextOpenAt } from "./schedule";
import { sendOrderConfirmation } from "./email";

export type CreateOrderResult =
  | { ok: true; ref: string; redirectUrl: string }
  | { ok: false; error: "kvittel_invalid" | "grave_unavailable" | "coupon_invalid" | "schedule_consent_required" | "rate_limited" | "server_error"; detail?: string; entryId?: string };

const newRef = () => `KV-${randomToken(5).replace(/[^A-Za-z0-9]/g, "").slice(0, 6).toUpperCase().padEnd(6, "X")}`;

export async function createOrder(input: CheckoutInput, ctx: { userId?: string | null }): Promise<CreateOrderResult> {
  const db = await getDb();

  // 1. Authoritative render of every kvittel (page count + blocking warnings)
  const rendered: Record<string, { pages: number; lengthMm: number; layoutVersion: string }> = {};
  for (const e of input.entries) {
    const r = await renderServer(e.content as KvittelContent);
    const blocking = r.layout.warnings.filter((w) => w.blocking);
    if (blocking.length) return { ok: false, error: "kvittel_invalid", entryId: e.id, detail: blocking.map((w) => w.code).join(",") };
    rendered[e.id] = { pages: r.layout.pages.length, lengthMm: r.layout.totalLengthMm, layoutVersion: r.layout.engineVersion };
  }

  // 2. Purchasability of each grave right now
  const slugs = [...new Set(input.entries.flatMap((e) => e.graveSlugs))];
  const gs = await db.select().from(graves).where(inArray(graves.slug, slugs));
  if (gs.length !== slugs.length) return { ok: false, error: "grave_unavailable" };
  const sched = await db.select().from(graveSchedules).where(inArray(graveSchedules.graveId, gs.map((g) => g.id)));
  const devs = await db
    .select({ graveId: deviceAssignments.graveId, deviceId: devices.id, status: devices.status, lastSeenAt: devices.lastSeenAt, paused: devices.paused })
    .from(deviceAssignments)
    .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
    .where(and(inArray(deviceAssignments.graveId, gs.map((g) => g.id)), sql`${deviceAssignments.unassignedAt} is null`));
  for (const g of gs) {
    if (!g.publishedAt) return { ok: false, error: "grave_unavailable", detail: g.slug };
    const a = computeAvailability(g, sched, devs);
    if (a.kind === "not_purchasable") return { ok: false, error: "grave_unavailable", detail: g.slug };
    if (a.kind === "scheduled" && (a.reason === "maintenance" || a.reason === "device_offline") && !input.acceptSchedule)
      return { ok: false, error: "schedule_consent_required", detail: g.slug };
  }

  // 3. Server-side price
  const items = input.entries.flatMap((e) => e.graveSlugs.map((slug) => ({ entryId: e.id, graveSlug: slug, pages: rendered[e.id]!.pages })));
  const q = await quote(input.currency, items, input.coupon);
  if (input.coupon && q.couponError) return { ok: false, error: "coupon_invalid", detail: q.couponError };

  // 4. Persist
  const ref = newRef();
  const trackingToken = randomToken(24);
  const email = input.email.trim().toLowerCase();
  const order = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({
        publicRef: ref,
        userId: ctx.userId ?? null,
        email,
        locale: input.locale,
        currency: input.currency,
        subtotalMinor: q.subtotalMinor,
        discountMinor: q.bundleDiscountMinor + q.couponDiscountMinor,
        totalMinor: q.totalMinor,
        couponId: q.coupon?.id ?? null,
        priceSnapshot: { lines: q.lines, bundleBps: q.bundleBps, coupon: q.coupon, couponDiscountMinor: q.couponDiscountMinor, quotedAt: new Date().toISOString() },
        marketingConsent: input.marketingConsent,
        isDemo: env.demoMode,
      })
      .returning();
    for (const e of input.entries) {
      const json = JSON.stringify(e.content);
      const [k] = await tx
        .insert(kvittels)
        .values({ contentEnc: seal(json), contentDigest: sha256(json), template: e.content.template, nusach: e.content.nusach, pageCount: rendered[e.id]!.pages, lengthMm: rendered[e.id]!.lengthMm, layoutVersion: rendered[e.id]!.layoutVersion })
        .returning();
      if (e.content.handwritingRef) await tx.update(kvittelFiles).set({ kvittelId: k!.id }).where(eq(kvittelFiles.uploadToken, e.content.handwritingRef));
      // Coupon discount is spread proportionally over lines for refunds accounting
      for (const line of q.lines.filter((l) => l.entryId === e.id)) {
        const share = q.subtotalMinor ? Math.round((q.couponDiscountMinor * (line.unitMinor + line.extrasMinor)) / q.subtotalMinor) : 0;
        await tx.insert(orderItems).values({
          orderId: o!.id,
          graveId: line.graveId,
          kvittelId: k!.id,
          pages: line.pages,
          unitPriceMinor: line.unitMinor,
          extrasMinor: line.extrasMinor,
          discountMinor: line.discountMinor + share,
          totalMinor: line.totalMinor - share,
        });
      }
    }
    await tx.insert(orderTrackingTokens).values({ orderId: o!.id, tokenHash: sha256(trackingToken), expiresAt: new Date(Date.now() + 120 * 86400000) });
    await tx.insert(userConsents).values([
      { userId: ctx.userId ?? null, email, kind: "terms", granted: true, source: `checkout:${ref}`, locale: input.locale },
      { userId: ctx.userId ?? null, email, kind: "marketing_email", granted: input.marketingConsent, source: `checkout:${ref}`, locale: input.locale },
    ]);
    return o!;
  });

  const provider = activeProvider();
  const trackUrl = `${env.appUrl}/${input.locale}/order/${ref}?t=${trackingToken}`;
  const checkout = await provider.createCheckout({
    orderId: order.id,
    ref,
    amountMinor: q.totalMinor,
    currency: input.currency,
    email,
    locale: input.locale,
    successUrl: trackUrl,
    cancelUrl: `${env.appUrl}/${input.locale}/cart`,
  });
  await db.insert(payments).values({ orderId: order.id, provider: provider.id, providerRef: checkout.providerRef, amountMinor: q.totalMinor, currency: input.currency, isDemo: provider.isDemo });
  // The buyer's browser keeps the tracking token in an httpOnly cookie, so the
  // post-payment redirect never needs it in a provider URL.
  const jar = await cookies();
  jar.set(`kv_t_${ref}`, trackingToken, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", maxAge: 120 * 86400 });
  await audit({ actorUserId: ctx.userId, action: "order.created", targetType: "order", targetId: order.id, meta: { ref, items: q.lines.length, currency: input.currency, total: q.totalMinor } });
  log.info("order.created", { ref, items: q.lines.length });
  return { ok: true, ref, redirectUrl: checkout.redirectUrl };
}

/** Idempotent processing of a verified provider event. Webhooks are the only source of payment truth. */
export async function processPaymentEvent(providerId: string, ev: VerifiedEvent, payloadDigest: string): Promise<{ outcome: string }> {
  const db = await getDb();
  const inserted = await db
    .insert(paymentEvents)
    .values({ provider: providerId, eventId: ev.eventId, type: ev.type, signatureValid: true, payloadDigest })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length) return { outcome: "duplicate_ignored" };
  const evRow = inserted[0]!;
  const finish = async (outcome: string, paymentId?: string) => {
    await db.update(paymentEvents).set({ processedAt: new Date(), outcome, paymentId }).where(eq(paymentEvents.id, evRow.id));
    return { outcome };
  };

  const [pay] = await db.select().from(payments).where(and(eq(payments.provider, providerId), eq(payments.providerRef, ev.providerRef))).limit(1);
  if (!pay) return finish("unknown_payment");

  if (ev.type === "payment.failed") {
    if (pay.status === "created") {
      await db.update(payments).set({ status: "failed" }).where(eq(payments.id, pay.id));
      await db.update(orders).set({ status: "payment_failed", updatedAt: new Date() }).where(eq(orders.id, pay.orderId));
    }
    return finish("marked_failed", pay.id);
  }
  if (ev.type !== "payment.succeeded") return finish("ignored_type", pay.id);
  if (pay.status === "succeeded") return finish("already_processed", pay.id);
  if (ev.amountMinor !== pay.amountMinor || (ev.currency ?? "").toUpperCase() !== pay.currency) {
    await audit({ actorKind: "webhook", action: "payment.amount_mismatch", targetType: "payment", targetId: pay.id, meta: { expected: pay.amountMinor, got: ev.amountMinor } });
    return finish("amount_mismatch", pay.id);
  }

  const [order] = await db.select().from(orders).where(eq(orders.id, pay.orderId));
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, pay.orderId));
  const gs = await db.select().from(graves).where(inArray(graves.id, [...new Set(items.map((i) => i.graveId))]));
  const sched = await db.select().from(graveSchedules).where(inArray(graveSchedules.graveId, gs.map((g) => g.id)));
  const devs = await db
    .select({ graveId: deviceAssignments.graveId, deviceId: devices.id, status: devices.status, lastSeenAt: devices.lastSeenAt, paused: devices.paused })
    .from(deviceAssignments)
    .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
    .where(sql`${deviceAssignments.unassignedAt} is null`);
  let anyScheduled = false;

  await db.transaction(async (tx) => {
    await tx.update(payments).set({ status: "succeeded", succeededAt: new Date() }).where(eq(payments.id, pay.id));
    await tx.update(orders).set({ status: "paid", paidAt: new Date(), updatedAt: new Date() }).where(eq(orders.id, pay.orderId));
    if (order?.couponId) await tx.update(coupons).set({ redeemedCount: sql`${coupons.redeemedCount} + 1` }).where(eq(coupons.id, order.couponId));
    for (const it of items) {
      const g = gs.find((x) => x.id === it.graveId)!;
      const a = computeAvailability(g, sched, devs);
      const scheduled = a.kind !== "available_now";
      const notBefore = scheduled && a.kind === "scheduled" && a.nextOpenAt ? new Date(a.nextOpenAt) : scheduled ? nextOpenAt(policyOf(g, sched), new Date()) : null;
      if (scheduled) anyScheduled = true;
      await tx.update(orderItems).set({ status: scheduled ? "scheduled" : "queued", scheduledFor: notBefore }).where(eq(orderItems.id, it.id));
      await tx
        .insert(printJobs)
        .values({ orderItemId: it.id, graveId: it.graveId, commandId: `cmd_${randomToken(16)}`, status: scheduled ? "scheduled" : "queued", notBefore })
        .onConflictDoNothing();
    }
  });
  await audit({ actorKind: "webhook", action: "payment.succeeded", targetType: "order", targetId: pay.orderId, meta: { provider: providerId, eventId: ev.eventId } });

  if (order) {
    try {
      const names = await db
        .select({ graveId: graveTranslations.graveId, name: graveTranslations.name, locale: graveTranslations.locale })
        .from(graveTranslations)
        .where(inArray(graveTranslations.graveId, gs.map((g) => g.id)));
      const graveNames = items.map((i) => (names.find((n) => n.graveId === i.graveId && n.locale === order.locale) ?? names.find((n) => n.graveId === i.graveId))?.name ?? "");
      // A fresh token for the email (the cookie token is not recoverable — only its hash is stored).
      const emailToken = randomToken(24);
      await db.insert(orderTrackingTokens).values({ orderId: order.id, tokenHash: sha256(emailToken), expiresAt: new Date(Date.now() + 120 * 86400000) });
      await sendOrderConfirmation(order.email, order.locale, {
        ref: order.publicRef,
        trackUrl: `${env.appUrl}/${order.locale}/order/${order.publicRef}?t=${emailToken}`,
        total: formatMoney(order.totalMinor, order.currency, order.locale),
        graves: graveNames,
        scheduled: anyScheduled,
      });
    } catch (e) {
      log.error("email.order_confirmation_failed", { ref: order.publicRef, err: (e as Error).message });
    }
  }
  return finish("paid", pay.id);
}

/* ───────────── tracking ───────────── */

export async function resolveTrackingAccess(ref: string, token: string | null | undefined): Promise<string | null> {
  const db = await getDb();
  const [o] = await db.select({ id: orders.id, userId: orders.userId }).from(orders).where(eq(orders.publicRef, ref)).limit(1);
  if (!o) return null;
  let candidate = token;
  if (!candidate) candidate = (await cookies()).get(`kv_t_${ref}`)?.value;
  if (!candidate) return null;
  const [t] = await db
    .select()
    .from(orderTrackingTokens)
    .where(and(eq(orderTrackingTokens.orderId, o.id), eq(orderTrackingTokens.tokenHash, sha256(candidate))))
    .limit(1);
  if (!t || t.expiresAt < new Date()) return null;
  return o.id;
}

export interface TimelineStep {
  key: "paid" | "queued" | "scheduled" | "sending" | "printing" | "printed" | "cut" | "chute_confirmed" | "delivered" | "uncertain" | "failed" | "refunded";
  at: string | null;
  state: "done" | "current" | "upcoming" | "problem";
}

export async function getOrderView(orderId: string, locale: string) {
  const db = await getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o) return null;
  const [pay] = await db.select().from(payments).where(eq(payments.orderId, o.id)).limit(1);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const jobs = items.length ? await db.select().from(printJobs).where(inArray(printJobs.orderItemId, items.map((i) => i.id))) : [];
  const attempts = jobs.length ? await db.select().from(printAttempts).where(inArray(printAttempts.jobId, jobs.map((j) => j.id))) : [];
  const gs = await db.select().from(graves).where(inArray(graves.id, items.map((i) => i.graveId)));
  const tr = await db.select().from(graveTranslations).where(inArray(graveTranslations.graveId, items.map((i) => i.graveId)));
  const pickName = (gid: string) => (tr.find((t) => t.graveId === gid && t.locale === locale) ?? tr.find((t) => t.graveId === gid && t.locale === "en") ?? tr.find((t) => t.graveId === gid))?.name ?? "";

  return {
    ref: o.publicRef,
    status: o.status,
    currency: o.currency,
    totalMinor: o.totalMinor,
    subtotalMinor: o.subtotalMinor,
    discountMinor: o.discountMinor,
    createdAt: o.createdAt.toISOString(),
    paidAt: o.paidAt?.toISOString() ?? null,
    paymentStatus: pay?.status ?? "created",
    isDemo: o.isDemo,
    items: items.map((it) => {
      const g = gs.find((x) => x.id === it.graveId)!;
      const job = jobs.find((j) => j.orderItemId === it.id);
      const att = attempts.filter((a) => a.jobId === job?.id).sort((a, b) => b.attemptNo - a.attemptNo)[0];
      return {
        id: it.id,
        graveSlug: g.slug,
        graveName: pickName(g.id),
        timezone: g.timezone,
        status: it.status,
        pages: it.pages,
        totalMinor: it.totalMinor,
        scheduledFor: it.scheduledFor?.toISOString() ?? null,
        deliveredAt: it.deliveredAt?.toISOString() ?? null,
        confidence: it.deliveryConfidence,
        timeline: buildTimeline(o.paidAt, it.status, job, att),
      };
    }),
  };
}

function buildTimeline(paidAt: Date | null, status: string, job?: typeof printJobs.$inferSelect, att?: typeof printAttempts.$inferSelect): TimelineStep[] {
  const iso = (d?: Date | null) => d?.toISOString() ?? null;
  const steps: Array<{ key: TimelineStep["key"]; at: string | null }> = [
    { key: "paid", at: iso(paidAt) },
    { key: job?.status === "scheduled" || status === "scheduled" ? "scheduled" : "queued", at: iso(job?.createdAt) },
    { key: "sending", at: iso(att?.leasedAt) },
    { key: "printing", at: iso(att?.startedAt) },
    { key: "printed", at: iso(att?.printedAt) },
    { key: "cut", at: iso(att?.cutAt) },
    { key: "chute_confirmed", at: iso(att?.chuteAt) },
    { key: "delivered", at: iso(job?.deliveredAt) },
  ];
  const terminalProblem = ["uncertain", "failed", "refunded"].includes(status) ? (status as TimelineStep["key"]) : null;
  let lastDone = -1;
  steps.forEach((s, i) => {
    if (s.at) lastDone = i;
  });
  const out: TimelineStep[] = steps.map((s, i) => ({ key: s.key, at: s.at, state: i <= lastDone ? "done" : i === lastDone + 1 && !terminalProblem && status !== "pending_payment" ? "current" : "upcoming" }));
  if (terminalProblem) {
    const cut = out.findIndex((s) => s.state === "upcoming");
    const kept = cut === -1 ? out : out.slice(0, cut);
    kept.push({ key: terminalProblem, at: iso(job?.updatedAt), state: "problem" });
    return kept;
  }
  return out;
}

export async function orderIdByRef(ref: string) {
  const db = await getDb();
  const [o] = await db.select({ id: orders.id, userId: orders.userId }).from(orders).where(eq(orders.publicRef, ref)).limit(1);
  return o ?? null;
}

