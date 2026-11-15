"use server";

import { and, eq, isNull } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { alerts, deviceAssignments, devices, graves, maintenanceLogs, maintenanceTickets, paperRolls } from "@kvittel/db";
import { resolveAlert } from "@/server/alerts";
import { audit } from "@/server/audit";
import { AuthError, assertGraveScope, requirePermission, type SessionUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { createPairingCode, currentAssignment, currentRoll, issueCommand, revokeDevice } from "@/server/devices";
import { env } from "@/server/env";

const uuid = z.string().uuid();

async function guard<T extends { ok: boolean }>(fn: () => Promise<T>): Promise<T | { ok: false; error: string }> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code };
    console.error("admin-fleet action failed", (e as Error).message);
    return { ok: false, error: "server_error" };
  }
}

/** Devices are scoped through their current grave assignment. */
async function assertDeviceScope(s: SessionUser, deviceId: string) {
  if (!s.graveScope) return;
  const a = await currentAssignment(deviceId);
  if (!a) throw new AuthError("forbidden");
  assertGraveScope(s, a.graveId);
}

/* ───────────── commands ───────────── */

const commandSchema = z.object({
  deviceId: uuid,
  type: z.enum(["test_print", "pause", "resume", "diagnostics", "clear_error", "reboot_agent"]),
  reason: z.string().trim().max(300).optional(),
});

export async function issueDeviceCommand(input: z.infer<typeof commandSchema>) {
  return guard(async () => {
    const s = await requirePermission("devices.command");
    const p = commandSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "invalid" };
    if (p.data.type === "reboot_agent" && (!p.data.reason || p.data.reason.length < 3)) return { ok: false, error: "reason_required" };
    await assertDeviceScope(s, p.data.deviceId);
    const id = await issueCommand(p.data.deviceId, p.data.type, null, s.id);
    if (p.data.reason) await audit({ actorUserId: s.id, action: `device.command.${p.data.type}.reason`, targetType: "device", targetId: p.data.deviceId, reason: p.data.reason });
    return { ok: true, commandId: id };
  });
}

/* ───────────── paper ───────────── */

const rollSchema = z.object({
  deviceId: uuid,
  outerDiameterMm: z.coerce.number().min(20).max(120),
  coreDiameterMm: z.coerce.number().min(5).max(40),
  thicknessMm: z.coerce.number().min(0.03).max(0.2),
  nominalLengthMm: z.coerce.number().int().min(1000).max(200000).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function recordRollChange(input: z.input<typeof rollSchema>) {
  return guard(async () => {
    const s = await requirePermission("maintenance.manage");
    const p = rollSchema.safeParse(input);
    if (!p.success || p.data.coreDiameterMm >= p.data.outerDiameterMm) return { ok: false, error: "invalid" };
    await assertDeviceScope(s, p.data.deviceId);
    const db = await getDb();
    const prev = await currentRoll(p.data.deviceId);
    if (prev) await db.update(paperRolls).set({ removedAt: new Date() }).where(eq(paperRolls.id, prev.id));
    await db.insert(paperRolls).values({
      deviceId: p.data.deviceId,
      outerDiameterMm: p.data.outerDiameterMm,
      coreDiameterMm: p.data.coreDiameterMm,
      thicknessMm: p.data.thicknessMm,
      nominalLengthMm: p.data.nominalLengthMm ?? null,
      // carry a learned calibration factor forward when the previous roll had one
      calibrationFactor: prev?.calibrationFactor ?? null,
      installedBy: s.id,
    });
    await resolveAlert("paper_low", { deviceId: p.data.deviceId });
    await resolveAlert("paper_end", { deviceId: p.data.deviceId });
    await audit({ actorUserId: s.id, action: "device.paper_roll.changed", targetType: "device", targetId: p.data.deviceId, meta: { previousUsedMm: prev?.usedMm ?? null, outer: p.data.outerDiameterMm }, reason: p.data.note });
    return { ok: true };
  });
}

/* ───────────── credentials & assignment ───────────── */

export async function revokeDeviceAction(input: { deviceId: string; reason: string }) {
  return guard(async () => {
    const s = await requirePermission("devices.provision");
    if (!uuid.safeParse(input.deviceId).success || (input.reason ?? "").trim().length < 3) return { ok: false, error: "reason_required" };
    await assertDeviceScope(s, input.deviceId);
    await revokeDevice(input.deviceId, s.id);
    await audit({ actorUserId: s.id, action: "device.revoked.reason", targetType: "device", targetId: input.deviceId, reason: input.reason.trim() });
    return { ok: true };
  });
}

export async function reassignDevice(input: { deviceId: string; graveId: string; note?: string }) {
  return guard(async () => {
    const s = await requirePermission("devices.provision");
    if (!uuid.safeParse(input.deviceId).success || !uuid.safeParse(input.graveId).success) return { ok: false, error: "invalid" };
    assertGraveScope(s, input.graveId);
    await assertDeviceScope(s, input.deviceId);
    const db = await getDb();
    const [g] = await db.select({ id: graves.id }).from(graves).where(eq(graves.id, input.graveId));
    if (!g) return { ok: false, error: "invalid" };
    await db.transaction(async (tx) => {
      await tx.update(deviceAssignments).set({ unassignedAt: new Date() }).where(and(eq(deviceAssignments.deviceId, input.deviceId), isNull(deviceAssignments.unassignedAt)));
      await tx.insert(deviceAssignments).values({ deviceId: input.deviceId, graveId: input.graveId, assertedBy: s.id, note: input.note?.slice(0, 300) ?? null });
    });
    await audit({ actorUserId: s.id, action: "device.reassigned", targetType: "device", targetId: input.deviceId, meta: { graveId: input.graveId }, reason: input.note });
    return { ok: true };
  });
}

export async function unassignDevice(input: { deviceId: string; reason: string }) {
  return guard(async () => {
    const s = await requirePermission("devices.provision");
    if (!uuid.safeParse(input.deviceId).success || (input.reason ?? "").trim().length < 3) return { ok: false, error: "reason_required" };
    await assertDeviceScope(s, input.deviceId);
    const db = await getDb();
    await db.update(deviceAssignments).set({ unassignedAt: new Date() }).where(and(eq(deviceAssignments.deviceId, input.deviceId), isNull(deviceAssignments.unassignedAt)));
    await audit({ actorUserId: s.id, action: "device.unassigned", targetType: "device", targetId: input.deviceId, reason: input.reason.trim() });
    return { ok: true };
  });
}

/* ───────────── pairing ───────────── */

export async function createPairing(input: { graveId: string; deviceName: string }) {
  return guard(async (): Promise<{ ok: true; code: string; expiresAt: string; qrSvg: string; server: string } | { ok: false; error: string }> => {
    const s = await requirePermission("devices.provision");
    const name = (input.deviceName ?? "").trim();
    if (!uuid.safeParse(input.graveId).success || name.length < 2 || name.length > 80) return { ok: false, error: "invalid" };
    assertGraveScope(s, input.graveId);
    const db = await getDb();
    const [g] = await db.select({ id: graves.id }).from(graves).where(eq(graves.id, input.graveId));
    if (!g) return { ok: false, error: "invalid" };
    const r = await createPairingCode({ graveId: input.graveId, deviceName: name, createdBy: s.id });
    const qrSvg = await QRCode.toString(JSON.stringify({ server: env.appUrl, code: r.code }), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0B1424", light: "#FDFBF6" } });
    return { ok: true as const, code: r.code, expiresAt: r.expiresAt, qrSvg, server: env.appUrl };
  });
}

/* ───────────── alerts ───────────── */

async function alertInScope(s: SessionUser, id: string) {
  const db = await getDb();
  const [a] = await db.select().from(alerts).where(eq(alerts.id, id));
  if (!a) return null;
  if (s.graveScope && (!a.graveId || !s.graveScope.includes(a.graveId))) throw new AuthError("forbidden");
  return a;
}

export async function acknowledgeAlert(id: string) {
  return guard(async () => {
    const s = await requirePermission("maintenance.manage");
    if (!uuid.safeParse(id).success) return { ok: false, error: "invalid" };
    const a = await alertInScope(s, id);
    if (!a || a.status !== "open") return { ok: false, error: "invalid" };
    const db = await getDb();
    await db.update(alerts).set({ status: "acknowledged", acknowledgedAt: new Date(), acknowledgedBy: s.id }).where(eq(alerts.id, id));
    await audit({ actorUserId: s.id, action: "alert.acknowledged", targetType: "alert", targetId: id, meta: { kind: a.kind } });
    return { ok: true };
  });
}

export async function resolveAlertAction(input: { id: string; note?: string }) {
  return guard(async () => {
    const s = await requirePermission("maintenance.manage");
    if (!uuid.safeParse(input.id).success) return { ok: false, error: "invalid" };
    const a = await alertInScope(s, input.id);
    if (!a || a.status === "resolved") return { ok: false, error: "invalid" };
    const db = await getDb();
    await db.update(alerts).set({ status: "resolved", resolvedAt: new Date() }).where(eq(alerts.id, input.id));
    await audit({ actorUserId: s.id, action: "alert.resolved", targetType: "alert", targetId: input.id, meta: { kind: a.kind }, reason: input.note?.slice(0, 300) });
    return { ok: true };
  });
}

/* ───────────── maintenance tickets ───────────── */

const ticketSchema = z.object({
  title: z.string().trim().min(3).max(160),
  kind: z.enum(["paper_change", "cleaning", "battery", "sensor", "cutter", "other"]),
  priority: z.coerce.number().int().min(1).max(3),
  deviceId: uuid.optional().or(z.literal("")),
  alertId: uuid.optional().or(z.literal("")),
  assigneeUserId: uuid.optional().or(z.literal("")),
  dueInHours: z.coerce.number().int().min(1).max(24 * 60).optional(),
});

export async function createTicket(input: z.input<typeof ticketSchema>) {
  return guard(async () => {
    const s = await requirePermission("maintenance.manage");
    const p = ticketSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "invalid" };
    const db = await getDb();
    let deviceId = p.data.deviceId || null;
    let graveId: string | null = null;
    if (p.data.alertId) {
      const a = await alertInScope(s, p.data.alertId);
      if (a) {
        deviceId ??= a.deviceId;
        graveId = a.graveId;
      }
    }
    if (deviceId) {
      await assertDeviceScope(s, deviceId);
      graveId ??= (await currentAssignment(deviceId))?.graveId ?? null;
      const [d] = await db.select({ id: devices.id }).from(devices).where(eq(devices.id, deviceId));
      if (!d) return { ok: false, error: "invalid" };
    }
    const due = new Date(Date.now() + (p.data.dueInHours ?? (p.data.priority === 1 ? 24 : p.data.priority === 2 ? 72 : 168)) * 3600_000);
    const [t] = await db
      .insert(maintenanceTickets)
      .values({ title: p.data.title, kind: p.data.kind, priority: p.data.priority, deviceId, graveId, alertId: p.data.alertId || null, assigneeUserId: p.data.assigneeUserId || null, dueAt: due, createdBy: s.id })
      .returning({ id: maintenanceTickets.id });
    await audit({ actorUserId: s.id, action: "ticket.created", targetType: "ticket", targetId: t!.id, meta: { kind: p.data.kind, priority: p.data.priority } });
    return { ok: true, id: t!.id };
  });
}

async function ticketInScope(s: SessionUser, id: string) {
  const db = await getDb();
  const [t] = await db.select().from(maintenanceTickets).where(eq(maintenanceTickets.id, id));
  if (!t) return null;
  if (s.graveScope && (!t.graveId || !s.graveScope.includes(t.graveId))) throw new AuthError("forbidden");
  return t;
}

export async function updateTicket(input: { id: string; status?: "open" | "in_progress" | "waiting_parts" | "resolved" | "closed"; assigneeUserId?: string | null }) {
  return guard(async () => {
    const s = await requirePermission("maintenance.manage");
    if (!uuid.safeParse(input.id).success) return { ok: false, error: "invalid" };
    const t = await ticketInScope(s, input.id);
    if (!t) return { ok: false, error: "invalid" };
    const set: Partial<typeof maintenanceTickets.$inferInsert> = {};
    if (input.status) {
      if (!["open", "in_progress", "waiting_parts", "resolved", "closed"].includes(input.status)) return { ok: false, error: "invalid" };
      set.status = input.status;
      set.closedAt = input.status === "resolved" || input.status === "closed" ? new Date() : null;
    }
    if (input.assigneeUserId !== undefined) {
      if (input.assigneeUserId && !uuid.safeParse(input.assigneeUserId).success) return { ok: false, error: "invalid" };
      set.assigneeUserId = input.assigneeUserId || null;
    }
    const db = await getDb();
    await db.update(maintenanceTickets).set(set).where(eq(maintenanceTickets.id, input.id));
    await audit({ actorUserId: s.id, action: "ticket.updated", targetType: "ticket", targetId: input.id, meta: { status: input.status, assignee: input.assigneeUserId } });
    return { ok: true };
  });
}

export async function addTicketNote(input: { id: string; note: string }) {
  return guard(async () => {
    const s = await requirePermission("maintenance.manage");
    const note = (input.note ?? "").trim();
    if (!uuid.safeParse(input.id).success || note.length < 1 || note.length > 2000) return { ok: false, error: "invalid" };
    const t = await ticketInScope(s, input.id);
    if (!t) return { ok: false, error: "invalid" };
    const db = await getDb();
    await db.insert(maintenanceLogs).values({ ticketId: input.id, authorUserId: s.id, note });
    return { ok: true };
  });
}
