import "server-only";
import { and, count, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { alerts, deviceAssignments, devices, graves, graveTranslations, maintenanceLogs, maintenanceTickets, paperRolls, printJobs } from "@kvittel/db";
import type { SessionUser } from "./auth/session";
import { getDb } from "./db";
import { currentAssignment, ONLINE_WINDOW_MS, paperEstimateFor } from "./devices";

/**
 * Operator (partner / local maintainer) read models. Everything is filtered by
 * the session's grave scope and NEVER touches kvittel content or order data.
 */

export async function scopedGraveIds(s: SessionUser): Promise<string[]> {
  const db = await getDb();
  if (s.graveScope) return s.graveScope;
  const rows = await db.select({ id: graves.id }).from(graves);
  return rows.map((r) => r.id);
}

async function graveNames(ids: string[], locale: string) {
  if (!ids.length) return new Map<string, string>();
  const db = await getDb();
  const tr = await db.select({ graveId: graveTranslations.graveId, locale: graveTranslations.locale, name: graveTranslations.name }).from(graveTranslations).where(inArray(graveTranslations.graveId, ids));
  const m = new Map<string, string>();
  for (const id of ids) {
    const mine = tr.filter((t) => t.graveId === id);
    m.set(id, (mine.find((t) => t.locale === locale) ?? mine.find((t) => t.locale === "en") ?? mine[0])?.name ?? "—");
  }
  return m;
}

export interface OperatorUnit {
  id: string;
  name: string;
  serial: string;
  status: string;
  paused: boolean;
  isSimulated: boolean;
  online: boolean;
  lastSeenAt: string | null;
  telemetry: Record<string, unknown> | null;
  paper: Awaited<ReturnType<typeof paperEstimateFor>>;
  rollInstalledAt: string | null;
  openAlerts: Array<{ id: string; kind: string; severity: string; openedAt: string }>;
  queueDepth: number;
}

export interface OperatorSite {
  graveId: string;
  slug: string;
  name: string;
  status: string;
  timezone: string;
  units: OperatorUnit[];
}

export async function operatorOverview(s: SessionUser, locale: string): Promise<OperatorSite[]> {
  const db = await getDb();
  const ids = await scopedGraveIds(s);
  if (!ids.length) return [];
  const gs = await db.select().from(graves).where(inArray(graves.id, ids));
  const assign = await db
    .select({ graveId: deviceAssignments.graveId, device: devices })
    .from(deviceAssignments)
    .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
    .where(and(inArray(deviceAssignments.graveId, ids), isNull(deviceAssignments.unassignedAt)));
  const names = await graveNames(ids, locale);
  const deviceIds = assign.map((a) => a.device.id);
  const openAl = deviceIds.length ? await db.select().from(alerts).where(and(inArray(alerts.deviceId, deviceIds), ne(alerts.status, "resolved"))) : [];
  const queue = await db
    .select({ graveId: printJobs.graveId, n: count() })
    .from(printJobs)
    .where(and(inArray(printJobs.graveId, ids), inArray(printJobs.status, ["queued", "scheduled", "leased"])))
    .groupBy(printJobs.graveId);
  const rolls = deviceIds.length ? await db.select().from(paperRolls).where(and(inArray(paperRolls.deviceId, deviceIds), isNull(paperRolls.removedAt))) : [];
  const now = Date.now();
  const out: OperatorSite[] = [];
  for (const g of gs.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const mine = assign.filter((a) => a.graveId === g.id);
    if (!mine.length && s.graveScope === null) continue; // unscoped admins: only sites with units
    const units: OperatorUnit[] = [];
    for (const { device: d } of mine) {
      const tel = (d.lastTelemetry ?? null) as Record<string, unknown> | null;
      units.push({
        id: d.id,
        name: d.name,
        serial: d.serial,
        status: d.status,
        paused: d.paused,
        isSimulated: d.isSimulated,
        online: !!d.lastSeenAt && now - d.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
        lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
        telemetry: tel,
        paper: await paperEstimateFor(d.id, tel?.paperSensor as string | undefined),
        rollInstalledAt: rolls.find((r) => r.deviceId === d.id)?.installedAt.toISOString() ?? null,
        openAlerts: openAl.filter((a) => a.deviceId === d.id).map((a) => ({ id: a.id, kind: a.kind, severity: a.severity, openedAt: a.openedAt.toISOString() })),
        queueDepth: 0,
      });
    }
    const q = Number(queue.find((x) => x.graveId === g.id)?.n ?? 0);
    units.forEach((u) => (u.queueDepth = q));
    out.push({ graveId: g.id, slug: g.slug, name: names.get(g.id) ?? g.slug, status: g.status, timezone: g.timezone, units });
  }
  return out;
}

/** Returns the device only if its current grave is within the session scope. */
export async function scopedDevice(s: SessionUser, deviceId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(deviceId)) return null;
  const db = await getDb();
  const [d] = await db.select().from(devices).where(eq(devices.id, deviceId));
  if (!d) return null;
  const a = await currentAssignment(d.id);
  if (!a) return null;
  if (s.graveScope && !s.graveScope.includes(a.graveId)) return null;
  return { device: d, graveId: a.graveId };
}

export async function deviceRollView(s: SessionUser, deviceId: string, locale: string) {
  const sd = await scopedDevice(s, deviceId);
  if (!sd) return null;
  const db = await getDb();
  const names = await graveNames([sd.graveId], locale);
  const [roll] = await db.select().from(paperRolls).where(and(eq(paperRolls.deviceId, deviceId), isNull(paperRolls.removedAt))).orderBy(desc(paperRolls.installedAt)).limit(1);
  const tel = (sd.device.lastTelemetry ?? null) as Record<string, unknown> | null;
  return {
    device: { id: sd.device.id, name: sd.device.name, serial: sd.device.serial, isSimulated: sd.device.isSimulated },
    graveName: names.get(sd.graveId) ?? "—",
    roll: roll ? { installedAt: roll.installedAt.toISOString(), outer: roll.outerDiameterMm, core: roll.coreDiameterMm, thickness: roll.thicknessMm, usedMm: Math.round(roll.usedMm) } : null,
    paper: await paperEstimateFor(deviceId, tel?.paperSensor as string | undefined),
  };
}

export async function operatorTickets(s: SessionUser, locale: string) {
  const db = await getDb();
  const ids = await scopedGraveIds(s);
  if (!ids.length) return { open: [], history: [], rollChanges: [], sites: [] as Array<{ graveId: string; name: string; devices: Array<{ id: string; name: string }> }> };
  const names = await graveNames(ids, locale);
  const tickets = await db.select().from(maintenanceTickets).where(inArray(maintenanceTickets.graveId, ids)).orderBy(desc(maintenanceTickets.createdAt)).limit(200);
  const logs = tickets.length ? await db.select().from(maintenanceLogs).where(inArray(maintenanceLogs.ticketId, tickets.map((t) => t.id))).orderBy(maintenanceLogs.createdAt) : [];
  const assign = await db
    .select({ graveId: deviceAssignments.graveId, id: devices.id, name: devices.name })
    .from(deviceAssignments)
    .innerJoin(devices, eq(devices.id, deviceAssignments.deviceId))
    .where(and(inArray(deviceAssignments.graveId, ids), isNull(deviceAssignments.unassignedAt)));
  const devIds = assign.map((a) => a.id);
  const rolls = devIds.length ? await db.select().from(paperRolls).where(inArray(paperRolls.deviceId, devIds)).orderBy(desc(paperRolls.installedAt)).limit(50) : [];
  const devName = (id: string | null) => assign.find((a) => a.id === id)?.name ?? null;
  const map = (t: (typeof tickets)[number]) => ({
    id: t.id,
    graveId: t.graveId!,
    graveName: names.get(t.graveId!) ?? "—",
    deviceName: devName(t.deviceId),
    kind: t.kind,
    title: t.title,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    closedAt: t.closedAt?.toISOString() ?? null,
    notes: logs.filter((l) => l.ticketId === t.id).map((l) => ({ id: l.id, note: l.note, at: l.createdAt.toISOString() })),
  });
  const sitesWithUnits = s.graveScope ? ids : [...new Set(assign.map((a) => a.graveId))];
  return {
    open: tickets.filter((t) => t.status !== "resolved" && t.status !== "closed").map(map),
    history: tickets.filter((t) => t.status === "resolved" || t.status === "closed").map(map),
    rollChanges: rolls.map((r) => ({ id: r.id, deviceName: devName(r.deviceId) ?? "—", installedAt: r.installedAt.toISOString(), removedAt: r.removedAt?.toISOString() ?? null, usedMm: Math.round(r.usedMm) })),
    sites: sitesWithUnits.map((g) => ({ graveId: g, name: names.get(g) ?? "—", devices: assign.filter((a) => a.graveId === g).map((a) => ({ id: a.id, name: a.name })) })),
  };
}
