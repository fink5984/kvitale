import "server-only";
import { and, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  deviceConfig,
  deviceEvents,
  graves,
  graveSchedules,
  graveTranslations,
  kvittels,
  openSealed,
  orderItems,
  orders,
  paperRolls,
  printAttempts,
  printJobs,
  randomToken,
} from "@kvittel/db";
import { rasterDigest, toBase64, type KvittelContent } from "@kvittel/print-layout";
import { audit } from "./audit";
import { openAlert } from "./alerts";
import { getDb } from "./db";
import { currentAssignment, currentRoll, type DeviceRow } from "./devices";
import { sendDeliveryUpdate } from "./email";
import { env } from "./env";
import { policyOf } from "./graves";
import { log } from "./log";
import { renderServer } from "./print";
import { closedReason } from "./schedule";

const MAX_AUTO_ATTEMPTS = 3;
const DEFAULT_LEASE_SEC = 90;
/** After printing has started, how long without any event before we declare `uncertain`. */
const IN_FLIGHT_GRACE_MS = 5 * 60_000;

type Job = typeof printJobs.$inferSelect;

export const JOB_EVENT_TYPES = ["print_started", "print_completed", "cut_completed", "chute_detected", "chute_timeout", "failed", "interrupted"] as const;
export type JobEventType = (typeof JOB_EVENT_TYPES)[number];

async function leaseSeconds(deviceId: string) {
  const db = await getDb();
  const [c] = await db.select().from(deviceConfig).where(eq(deviceConfig.deviceId, deviceId));
  const v = Number((c?.config as Record<string, unknown> | undefined)?.leaseSec);
  return Number.isFinite(v) && v >= 30 ? v : DEFAULT_LEASE_SEC;
}

/* ───────────── sweeps (called on lease, heartbeat and by the worker) ───────────── */

export async function sweepExpiredLeases() {
  const db = await getDb();
  const now = new Date();
  const expired = await db.select().from(printJobs).where(and(eq(printJobs.status, "leased"), lt(printJobs.leaseExpiresAt, now)));
  for (const j of expired) {
    const [att] = await db.select().from(printAttempts).where(eq(printAttempts.leaseId, j.leaseId ?? ""));
    if (att && !att.startedAt) {
      // Never started printing → safe to retry.
      await db.update(printAttempts).set({ outcome: "expired" }).where(eq(printAttempts.id, att.id));
      await requeueOrFail(j, "lease_expired_before_print");
    } else {
      await markUncertain(j, "lease_expired_after_print_start");
    }
  }
  const stale = await db
    .select()
    .from(printJobs)
    .where(and(inArray(printJobs.status, ["printing", "printed", "cut"]), lt(printJobs.leaseExpiresAt, new Date(now.getTime() - IN_FLIGHT_GRACE_MS))));
  for (const j of stale) await markUncertain(j, "no_events_after_print_start");
}

/** Scheduled jobs without a window (maintenance) become eligible once the grave is active again. */
export async function promoteScheduled() {
  const db = await getDb();
  const rows = await db
    .select({ id: printJobs.id })
    .from(printJobs)
    .innerJoin(graves, eq(graves.id, printJobs.graveId))
    .where(and(eq(printJobs.status, "scheduled"), isNull(printJobs.notBefore), eq(graves.status, "active")));
  if (rows.length) await db.update(printJobs).set({ notBefore: new Date(), updatedAt: new Date() }).where(inArray(printJobs.id, rows.map((r) => r.id)));
}

async function requeueOrFail(j: Job, reason: string) {
  const db = await getDb();
  if (j.attempts >= MAX_AUTO_ATTEMPTS) {
    await db.update(printJobs).set({ status: "failed", leaseId: null, lastError: reason, updatedAt: new Date() }).where(eq(printJobs.id, j.id));
    if (j.orderItemId) await setItemStatus(j.orderItemId, "failed");
    return;
  }
  await db.update(printJobs).set({ status: "queued", leaseId: null, leaseExpiresAt: null, deviceId: j.isTest ? j.deviceId : null, lastError: reason, updatedAt: new Date() }).where(eq(printJobs.id, j.id));
  if (j.orderItemId) await setItemStatus(j.orderItemId, "queued");
}

async function markUncertain(j: Job, reason: string) {
  const db = await getDb();
  await db.update(printJobs).set({ status: "uncertain", lastError: reason, updatedAt: new Date() }).where(eq(printJobs.id, j.id));
  if (j.leaseId) await db.update(printAttempts).set({ outcome: "uncertain", error: reason }).where(eq(printAttempts.leaseId, j.leaseId));
  await openAlert("print_uncertain", { deviceId: j.deviceId, graveId: j.graveId, key: j.id }, { jobId: j.id, reason });
  if (j.orderItemId) {
    await setItemStatus(j.orderItemId, "uncertain");
    await notifyItem(j.orderItemId, "uncertain");
  }
  log.warn("job.uncertain", { jobId: j.id, reason });
}

async function setItemStatus(itemId: string, status: (typeof orderItems.$inferSelect)["status"], extra: Partial<typeof orderItems.$inferInsert> = {}) {
  const db = await getDb();
  const [it] = await db.update(orderItems).set({ status, ...extra }).where(eq(orderItems.id, itemId)).returning();
  if (it) await recomputeOrderStatus(it.orderId);
}

export async function recomputeOrderStatus(orderId: string) {
  const db = await getDb();
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!o || o.status === "pending_payment" || o.status === "payment_failed" || o.status === "canceled") return;
  const items = await db.select({ status: orderItems.status }).from(orderItems).where(eq(orderItems.orderId, orderId));
  const st = items.map((i) => i.status);
  let next: (typeof orders.$inferSelect)["status"];
  if (st.every((s) => s === "refunded")) next = "refunded";
  else if (st.some((s) => s === "uncertain" || s === "failed")) next = "attention";
  else if (st.every((s) => s === "delivered" || s === "refunded")) next = st.some((s) => s === "refunded") ? "partially_refunded" : "fulfilled";
  else if (st.some((s) => s !== "queued" && s !== "scheduled")) next = "in_fulfillment";
  else next = st.some((s) => s === "refunded") ? "partially_refunded" : "paid";
  if (next !== o.status) await db.update(orders).set({ status: next, updatedAt: new Date() }).where(eq(orders.id, orderId));
}

async function notifyItem(itemId: string, status: "delivered" | "uncertain" | "failed") {
  try {
    const db = await getDb();
    const [row] = await db.select({ item: orderItems, order: orders }).from(orderItems).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(eq(orderItems.id, itemId));
    if (!row || row.order.isDemo && row.order.email.endsWith("@demo.kvittel.local")) return;
    const names = await db.select().from(graveTranslations).where(eq(graveTranslations.graveId, row.item.graveId));
    const name = (names.find((n) => n.locale === row.order.locale) ?? names[0])?.name ?? "";
    // Tracking link without token: the customer uses the link from their confirmation mail.
    await sendDeliveryUpdate(row.order.email, row.order.locale, { ref: row.order.publicRef, trackUrl: `${env.appUrl}/${row.order.locale}/order/${row.order.publicRef}`, grave: name, status });
  } catch (e) {
    log.error("email.delivery_update_failed", { itemId, err: (e as Error).message });
  }
}

/* ───────────── lease ───────────── */

export interface LeasedJob {
  jobId: string;
  commandId: string;
  leaseId: string;
  leaseExpiresAt: string;
  attemptNo: number;
  isTest: boolean;
  raster: { format: "packed-1bpp-msb"; widthDots: number; bytesPerRow: number; pages: Array<{ heightDots: number; data: string }>; digest: string; lengthMm: number; feedBeforeCutMm: number; cut: "full" };
}

export async function leaseJob(device: DeviceRow): Promise<LeasedJob | null> {
  await sweepExpiredLeases();
  await promoteScheduled();
  if (device.paused || device.status !== "active") return null;
  const assignment = await currentAssignment(device.id);
  if (!assignment) return null;
  const db = await getDb();
  const [g] = await db.select().from(graves).where(eq(graves.id, assignment.graveId));
  if (!g) return null;
  const sched = await db.select().from(graveSchedules).where(eq(graveSchedules.graveId, g.id));
  const now = new Date();
  const customerAllowed = g.status === "active" && !closedReason(policyOf(g, sched), now);
  const leaseSec = await leaseSeconds(device.id);
  const leaseId = `lease_${randomToken(12)}`;
  const leaseExpiresAt = new Date(now.getTime() + leaseSec * 1000);

  const leased = await db.transaction(async (tx) => {
    let [cand] = await tx
      .select()
      .from(printJobs)
      .where(and(eq(printJobs.status, "queued"), eq(printJobs.isTest, true), eq(printJobs.deviceId, device.id)))
      .orderBy(printJobs.createdAt)
      .limit(1)
      .for("update", { skipLocked: true });
    if (!cand && customerAllowed) {
      [cand] = await tx
        .select()
        .from(printJobs)
        .where(and(eq(printJobs.graveId, g.id), eq(printJobs.isTest, false), or(eq(printJobs.status, "queued"), and(eq(printJobs.status, "scheduled"), lte(printJobs.notBefore, now)))))
        .orderBy(printJobs.createdAt)
        .limit(1)
        .for("update", { skipLocked: true });
    }
    if (!cand) return null;
    const attemptNo = cand.attempts + 1;
    const [j] = await tx.update(printJobs).set({ status: "leased", leaseId, leaseExpiresAt, deviceId: device.id, attempts: attemptNo, updatedAt: now }).where(eq(printJobs.id, cand.id)).returning();
    await tx.insert(printAttempts).values({ jobId: cand.id, deviceId: device.id, attemptNo, leaseId, leasedAt: now });
    if (cand.orderItemId) await tx.update(orderItems).set({ status: "sending" }).where(eq(orderItems.id, cand.orderItemId));
    return j!;
  });
  if (!leased) return null;

  // Render outside the transaction. Content is decrypted only in memory.
  try {
    let content: KvittelContent;
    let reference = leased.id.slice(0, 6).toUpperCase();
    if (leased.isTest) {
      content = { template: "classic", nusach: "he", graveDisplayName: "TEST PRINT · הדפסת ניסיון", people: [{ id: "t", mode: "free", given: "", relation: "none", freeText: device.name }], topics: [], request: "בדיקת מדפסת, חיתוך וחיישן תעלה.\nPrinter, cutter and chute sensor check.\nПроверка принтера — Test d'impression.", showBH: false };
      reference = "TEST";
    } else {
      const [row] = await db.select({ k: kvittels, o: orders }).from(orderItems).innerJoin(kvittels, eq(kvittels.id, orderItems.kvittelId)).innerJoin(orders, eq(orders.id, orderItems.orderId)).where(eq(orderItems.id, leased.orderItemId!));
      if (!row?.k.contentEnc) throw new Error("content_unavailable");
      content = JSON.parse(openSealed(row.k.contentEnc).toString("utf8")) as KvittelContent;
      reference = row.o.publicRef.replace("KV-", "");
    }
    const r = await renderServer(content, { reference, at: now });
    const pages = r.rasters.map((x) => ({ heightDots: x.height, data: toBase64(x.data) }));
    const digest = r.rasters.map(rasterDigest).join("+");
    await db.update(printJobs).set({ rasterDigest: digest, lengthMm: r.layout.totalLengthMm }).where(eq(printJobs.id, leased.id));
    log.info("job.leased", { jobId: leased.id, deviceId: device.id, attempt: leased.attempts, pages: pages.length });
    return {
      jobId: leased.id,
      commandId: leased.commandId,
      leaseId,
      leaseExpiresAt: leaseExpiresAt.toISOString(),
      attemptNo: leased.attempts,
      isTest: leased.isTest,
      raster: { format: "packed-1bpp-msb", widthDots: r.layout.widthDots, bytesPerRow: Math.ceil(r.layout.widthDots / 8), pages, digest, lengthMm: r.layout.totalLengthMm, feedBeforeCutMm: 12, cut: "full" },
    };
  } catch (e) {
    log.error("job.render_failed", { jobId: leased.id, err: (e as Error).message });
    await db.update(printAttempts).set({ outcome: "failed_before_print", error: "render_failed" }).where(eq(printAttempts.leaseId, leaseId));
    await requeueOrFail({ ...leased, attempts: MAX_AUTO_ATTEMPTS }, "render_failed");
    return null;
  }
}

/* ───────────── job events (state machine) ───────────── */

export async function handleJobEvent(
  device: DeviceRow,
  jobId: string,
  body: { leaseId: string; eventUid: string; type: JobEventType; at?: string; data?: { error?: string; phase?: string; reason?: string } },
): Promise<{ status: string; next: "continue" | "stop" } | { error: "not_found" }> {
  const db = await getDb();
  const [job] = await db.select().from(printJobs).where(and(eq(printJobs.id, jobId), eq(printJobs.deviceId, device.id)));
  if (!job) return { error: "not_found" };
  const at = body.at && !Number.isNaN(Date.parse(body.at)) ? new Date(body.at) : new Date();

  const ins = await db
    .insert(deviceEvents)
    .values({ deviceId: device.id, eventUid: body.eventUid.slice(0, 80), type: `job.${body.type}`, jobId, severity: body.type === "failed" || body.type === "chute_timeout" || body.type === "interrupted" ? "warning" : "info", data: { leaseId: body.leaseId, error: body.data?.error, phase: body.data?.phase }, occurredAt: at })
    .onConflictDoNothing()
    .returning({ id: deviceEvents.id });
  const terminal = ["delivered", "uncertain", "failed", "canceled"].includes(job.status);
  if (!ins.length) return { status: job.status, next: job.leaseId === body.leaseId && !terminal ? "continue" : "stop" }; // duplicate → idempotent

  if (job.leaseId !== body.leaseId) {
    // Event from an older lease. If the job is still waiting and this was its latest attempt, re-adopt; otherwise stop.
    const [att] = await db.select().from(printAttempts).where(eq(printAttempts.leaseId, body.leaseId));
    if (att && job.status === "queued" && att.attemptNo === job.attempts && body.type === "print_started") {
      await db.update(printJobs).set({ leaseId: body.leaseId, status: "leased", deviceId: device.id }).where(eq(printJobs.id, job.id));
      job.leaseId = body.leaseId;
      job.status = "leased";
    } else {
      if (att && (body.type === "print_started" || body.type === "print_completed") && !terminal) await markUncertain(job, "event_for_stale_lease");
      return { status: job.status, next: "stop" };
    }
  }
  if (terminal && body.type !== "chute_detected") return { status: job.status, next: "stop" };

  const leaseSec = await leaseSeconds(device.id);
  const extend = { leaseExpiresAt: new Date(Date.now() + leaseSec * 1000), updatedAt: new Date() };
  const attWhere = eq(printAttempts.leaseId, body.leaseId);
  const item = job.orderItemId;
  let status: Job["status"] = job.status;

  switch (body.type) {
    case "print_started":
      status = "printing";
      await db.update(printAttempts).set({ startedAt: at }).where(attWhere);
      if (item) await setItemStatus(item, "printing");
      break;
    case "print_completed": {
      status = "printed";
      await db.update(printAttempts).set({ printedAt: at }).where(attWhere);
      if (item) await setItemStatus(item, "printed");
      const roll = await currentRoll(device.id);
      if (roll && job.lengthMm) await db.update(paperRolls).set({ usedMm: sql`${paperRolls.usedMm} + ${job.lengthMm}` }).where(eq(paperRolls.id, roll.id));
      break;
    }
    case "cut_completed": {
      status = "cut";
      await db.update(printAttempts).set({ cutAt: at }).where(attWhere);
      const caps = (device.lastTelemetry as { capabilities?: Record<string, string> } | null)?.capabilities;
      if (caps?.chuteSensor === "unsupported") {
        // No end sensor on this hardware: delivered, but explicitly with lower confidence.
        await db.update(printJobs).set({ status: "delivered", confidence: "printer_reported", deliveredAt: at, ...extend }).where(eq(printJobs.id, job.id));
        await db.update(printAttempts).set({ outcome: "delivered" }).where(attWhere);
        if (item) {
          await setItemStatus(item, "delivered", { deliveredAt: at, deliveryConfidence: "printer_reported" });
          await afterDelivered(item);
        }
        return { status: "delivered", next: "continue" };
      }
      if (item) await setItemStatus(item, "cut");
      break;
    }
    case "chute_detected":
      await db.update(printAttempts).set({ chuteAt: at, outcome: "delivered" }).where(attWhere);
      await db.update(printJobs).set({ status: "delivered", confidence: "sensor_confirmed", deliveredAt: at, ...extend }).where(eq(printJobs.id, job.id));
      if (item && !terminal) {
        await setItemStatus(item, "delivered", { deliveredAt: at, deliveryConfidence: "sensor_confirmed" });
        await afterDelivered(item);
      }
      log.info("job.delivered", { jobId: job.id });
      return { status: "delivered", next: "continue" };
    case "chute_timeout":
    case "interrupted":
      await markUncertain(job, body.type === "chute_timeout" ? "chute_sensor_timeout" : "agent_interrupted");
      return { status: "uncertain", next: "stop" };
    case "failed": {
      const err = body.data?.error ?? "other";
      if (err === "paper_end") await openAlert("paper_end", { deviceId: device.id, graveId: job.graveId });
      if (err === "cover_open") await openAlert("cover_open", { deviceId: device.id, graveId: job.graveId });
      if (err === "cutter_jam") await openAlert("cutter_fault", { deviceId: device.id, graveId: job.graveId });
      // The agent only prints after `print_started` is acknowledged. If that ack was lost the server may
      // already be in `printing`; a `before_print` failure with no `printedAt` is still a safe retry.
      const [curAtt] = await db.select({ printedAt: printAttempts.printedAt }).from(printAttempts).where(attWhere);
      if (body.data?.phase === "before_print" && (job.status === "leased" || (job.status === "printing" && !curAtt?.printedAt))) {
        await db.update(printAttempts).set({ outcome: "failed_before_print", error: err }).where(attWhere);
        await requeueOrFail(job, `device_failed_before_print:${err}`);
        const [after] = await db.select({ status: printJobs.status }).from(printJobs).where(eq(printJobs.id, job.id));
        return { status: after?.status ?? "queued", next: "stop" };
      }
      await markUncertain(job, `device_failed_${body.data?.phase ?? "unknown"}:${err}`);
      return { status: "uncertain", next: "stop" };
    }
  }
  await db.update(printJobs).set({ status, ...extend }).where(eq(printJobs.id, job.id));
  return { status, next: "continue" };
}

async function afterDelivered(itemId: string) {
  const db = await getDb();
  const [it] = await db.select().from(orderItems).where(eq(orderItems.id, itemId));
  if (!it) return;
  const siblings = await db.select({ status: orderItems.status }).from(orderItems).where(eq(orderItems.kvittelId, it.kvittelId));
  if (siblings.every((s) => s.status === "delivered" || s.status === "refunded")) {
    await db.update(kvittels).set({ retentionUntil: new Date(Date.now() + env.kvittelRetentionDays * 86400000) }).where(eq(kvittels.id, it.kvittelId));
  }
  await notifyItem(itemId, "delivered");
}

/** Retention: purge kvittel content after the retention window. Irreversible by design. */
export async function purgeExpiredContent() {
  const db = await getDb();
  const rows = await db.update(kvittels).set({ contentEnc: null, purgedAt: new Date() }).where(and(lt(kvittels.retentionUntil, new Date()), isNull(kvittels.purgedAt))).returning({ id: kvittels.id });
  if (rows.length) await audit({ actorKind: "system", action: "retention.kvittel_purged", meta: { count: rows.length } });
}

/** Admin: after a human verified what happened physically. */
export async function resolveUncertain(jobId: string, decision: "delivered" | "requeue" | "failed", userId: string, reason: string) {
  const db = await getDb();
  const [job] = await db.select().from(printJobs).where(eq(printJobs.id, jobId));
  if (!job || (job.status !== "uncertain" && job.status !== "failed")) return false;
  if (decision === "delivered") {
    await db.update(printJobs).set({ status: "delivered", confidence: "manual", deliveredAt: new Date(), updatedAt: new Date() }).where(eq(printJobs.id, jobId));
    if (job.orderItemId) await setItemStatus(job.orderItemId, "delivered", { deliveredAt: new Date(), deliveryConfidence: "manual" });
  } else if (decision === "requeue") {
    await db.update(printJobs).set({ status: "queued", leaseId: null, leaseExpiresAt: null, deviceId: null, attempts: 0, updatedAt: new Date() }).where(eq(printJobs.id, jobId));
    if (job.orderItemId) await setItemStatus(job.orderItemId, "queued");
  } else {
    await db.update(printJobs).set({ status: "failed", updatedAt: new Date() }).where(eq(printJobs.id, jobId));
    if (job.orderItemId) await setItemStatus(job.orderItemId, "failed");
  }
  await audit({ actorUserId: userId, action: `job.resolve.${decision}`, targetType: "print_job", targetId: jobId, reason });
  return true;
}
