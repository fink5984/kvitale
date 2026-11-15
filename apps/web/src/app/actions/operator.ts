"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { maintenanceLogs, maintenanceTickets, paperRolls } from "@kvittel/db";
import { resolveAlert } from "@/server/alerts";
import { audit } from "@/server/audit";
import { assertGraveScope, AuthError, requirePermission } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { issueCommand } from "@/server/devices";
import { scopedDevice } from "@/server/operator-queries";

type Result = { ok: true } | { ok: false; error: "forbidden" | "invalid" | "not_found" | "server_error" };

async function guarded(fn: () => Promise<Result>): Promise<Result> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "forbidden" };
    console.error("operator_action_failed", (e as Error).message);
    return { ok: false, error: "server_error" };
  }
}

const rollSchema = z.object({
  deviceId: z.string().uuid(),
  outer: z.number().min(20).max(90),
  core: z.number().min(5).max(30),
  thickness: z.number().min(0.03).max(0.15),
  nominalMm: z.number().int().min(1000).max(120000).optional(),
});

/** Paper roll change: closes the current roll, starts a new one, resolves paper alerts and the open paper ticket. */
export async function changeRoll(input: z.infer<typeof rollSchema>): Promise<Result> {
  return guarded(async () => {
    const s = await requirePermission("maintenance.manage");
    const p = rollSchema.safeParse(input);
    if (!p.success || p.data.core >= p.data.outer) return { ok: false, error: "invalid" };
    const sd = await scopedDevice(s, p.data.deviceId);
    if (!sd) return { ok: false, error: "not_found" };
    const db = await getDb();
    const now = new Date();
    let ticketId: string | null = null;
    await db.transaction(async (tx) => {
      await tx.update(paperRolls).set({ removedAt: now }).where(and(eq(paperRolls.deviceId, sd.device.id), isNull(paperRolls.removedAt)));
      const [open] = await tx
        .select()
        .from(maintenanceTickets)
        .where(and(eq(maintenanceTickets.deviceId, sd.device.id), eq(maintenanceTickets.kind, "paper_change"), inArray(maintenanceTickets.status, ["open", "in_progress", "waiting_parts"])))
        .limit(1);
      ticketId = open?.id ?? null;
      await tx.insert(paperRolls).values({ deviceId: sd.device.id, installedAt: now, outerDiameterMm: p.data.outer, coreDiameterMm: p.data.core, thicknessMm: p.data.thickness, nominalLengthMm: p.data.nominalMm ?? null, installedBy: s.id, ticketId });
      if (open) {
        await tx.insert(maintenanceLogs).values({ ticketId: open.id, authorUserId: s.id, note: `Paper roll replaced (${p.data.outer}/${p.data.core}/${p.data.thickness} mm)` });
        await tx.update(maintenanceTickets).set({ status: "resolved", closedAt: now }).where(eq(maintenanceTickets.id, open.id));
      }
    });
    await resolveAlert("paper_low", { deviceId: sd.device.id });
    await resolveAlert("paper_end", { deviceId: sd.device.id });
    await audit({ actorUserId: s.id, action: "operator.paper_roll_changed", targetType: "device", targetId: sd.device.id, meta: { outer: p.data.outer, core: p.data.core, thickness: p.data.thickness, ticketId } });
    return { ok: true };
  });
}

export async function operatorTestPrint(deviceId: string): Promise<Result> {
  return guarded(async () => {
    const s = await requirePermission("operator.test_print");
    const sd = await scopedDevice(s, deviceId);
    if (!sd) return { ok: false, error: "not_found" };
    await issueCommand(sd.device.id, "test_print", {}, s.id);
    await audit({ actorUserId: s.id, action: "operator.test_print", targetType: "device", targetId: sd.device.id });
    return { ok: true };
  });
}

const ticketSchema = z.object({
  graveId: z.string().uuid(),
  deviceId: z.string().uuid().optional(),
  kind: z.enum(["paper_change", "cleaning", "battery", "sensor", "cutter", "other"]),
  title: z.string().trim().min(3).max(160),
  priority: z.number().int().min(1).max(3),
});

export async function createTicket(input: z.infer<typeof ticketSchema>): Promise<Result> {
  return guarded(async () => {
    const s = await requirePermission("maintenance.manage");
    const p = ticketSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "invalid" };
    assertGraveScope(s, p.data.graveId);
    if (p.data.deviceId) {
      const sd = await scopedDevice(s, p.data.deviceId);
      if (!sd || sd.graveId !== p.data.graveId) return { ok: false, error: "not_found" };
    }
    const db = await getDb();
    const due = new Date(Date.now() + (p.data.priority === 1 ? 1 : p.data.priority === 2 ? 3 : 7) * 86400000);
    const [t] = await db.insert(maintenanceTickets).values({ graveId: p.data.graveId, deviceId: p.data.deviceId ?? null, kind: p.data.kind, title: p.data.title, priority: p.data.priority, dueAt: due, createdBy: s.id }).returning();
    await audit({ actorUserId: s.id, action: "operator.ticket_created", targetType: "ticket", targetId: t!.id, meta: { kind: p.data.kind, priority: p.data.priority } });
    return { ok: true };
  });
}

async function scopedTicket(ticketId: string) {
  const s = await requirePermission("maintenance.manage");
  if (!/^[0-9a-f-]{36}$/i.test(ticketId)) return null;
  const db = await getDb();
  const [t] = await db.select().from(maintenanceTickets).where(eq(maintenanceTickets.id, ticketId));
  if (!t || !t.graveId) return null;
  assertGraveScope(s, t.graveId);
  return { s, t };
}

export async function addTicketNote(ticketId: string, note: string): Promise<Result> {
  return guarded(async () => {
    const r = await scopedTicket(ticketId);
    const text = note.trim().slice(0, 2000);
    if (!r) return { ok: false, error: "not_found" };
    if (text.length < 2) return { ok: false, error: "invalid" };
    const db = await getDb();
    await db.insert(maintenanceLogs).values({ ticketId, authorUserId: r.s.id, note: text });
    return { ok: true };
  });
}

export async function setTicketStatus(ticketId: string, status: "open" | "in_progress" | "waiting_parts" | "resolved" | "closed"): Promise<Result> {
  return guarded(async () => {
    const r = await scopedTicket(ticketId);
    if (!r) return { ok: false, error: "not_found" };
    if (!["open", "in_progress", "waiting_parts", "resolved", "closed"].includes(status)) return { ok: false, error: "invalid" };
    const db = await getDb();
    await db
      .update(maintenanceTickets)
      .set({ status, closedAt: status === "resolved" || status === "closed" ? new Date() : null })
      .where(eq(maintenanceTickets.id, ticketId));
    await audit({ actorUserId: r.s.id, action: "operator.ticket_status", targetType: "ticket", targetId: ticketId, meta: { status } });
    return { ok: true };
  });
}
