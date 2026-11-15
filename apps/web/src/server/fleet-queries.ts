import "server-only";
import { and, desc, eq, gt, inArray, isNull, ne, or, type SQL } from "drizzle-orm";
import {
  alerts,
  deviceAssignments,
  deviceCommands,
  deviceCredentials,
  deviceEvents,
  devicePairingCodes,
  devices,
  deviceTelemetry,
  graves,
  graveTranslations,
  maintenanceLogs,
  maintenanceTickets,
  paperRolls,
  printJobs,
  roleAssignments,
  users,
} from "@kvittel/db";
import type { PaperEstimate } from "@kvittel/print-layout";
import { getDb } from "./db";
import { ONLINE_WINDOW_MS, OFFLINE_ALERT_MS, paperEstimateFor } from "./devices";

/**
 * Fleet read models for the admin console. Never selects kvittel content, raster
 * digests are the most a job row exposes. Scoped users only see their graves.
 */

export type Connectivity = "online" | "heartbeat_missed" | "offline" | "never_seen";

export function connectivityOf(lastSeenAt: Date | null, now = Date.now()): Connectivity {
  if (!lastSeenAt) return "never_seen";
  const d = now - lastSeenAt.getTime();
  if (d < ONLINE_WINDOW_MS) return "online";
  if (d < OFFLINE_ALERT_MS) return "heartbeat_missed";
  return "offline";
}

export interface Tele {
  network?: string;
  signalDbm?: number | null;
  latencyMs?: number | null;
  power?: string;
  batteryPct?: number | null;
  paperSensor?: string;
  cover?: string;
  cutter?: string;
  chuteSensor?: string;
  camera?: string;
  tempC?: number | null;
  uptimeS?: number;
  queueDepth?: number;
  capabilities?: Record<string, string>;
}

/** Map localized grave names, falling back en → he → any. */
export async function graveNames(locale: string, ids?: string[]) {
  const db = await getDb();
  const rows = await db
    .select({ graveId: graveTranslations.graveId, locale: graveTranslations.locale, name: graveTranslations.name })
    .from(graveTranslations)
    .where(ids ? (ids.length ? inArray(graveTranslations.graveId, ids) : eq(graveTranslations.graveId, "00000000-0000-0000-0000-000000000000")) : undefined);
  const out = new Map<string, string>();
  for (const pref of ["he", "en", locale]) for (const r of rows) if (r.locale === pref || !out.has(r.graveId)) out.set(r.graveId, r.name);
  return out;
}

export async function allGravesForSelect(locale: string, scope: string[] | null) {
  const db = await getDb();
  const gs = await db.select({ id: graves.id, slug: graves.slug, status: graves.status }).from(graves).where(scope ? inArray(graves.id, scope.length ? scope : ["00000000-0000-0000-0000-000000000000"]) : undefined);
  const names = await graveNames(locale, gs.map((g) => g.id));
  return gs.map((g) => ({ id: g.id, slug: g.slug, status: g.status, name: names.get(g.id) ?? g.slug })).sort((a, b) => a.name.localeCompare(b.name, locale));
}

export interface FleetRow {
  id: string;
  name: string;
  serial: string;
  status: string;
  paused: boolean;
  simulated: boolean;
  agentVersion: string | null;
  lastSeenAt: string | null;
  connectivity: Connectivity;
  graveId: string | null;
  graveName: string | null;
  tele: Tele;
  paper: PaperEstimate | null;
  openAlerts: number;
}

export async function listFleet(locale: string, scope: string[] | null): Promise<FleetRow[]> {
  const db = await getDb();
  const ds = await db.select().from(devices).orderBy(devices.name);
  const assigns = await db.select().from(deviceAssignments).where(isNull(deviceAssignments.unassignedAt));
  const graveIds = [...new Set(assigns.map((a) => a.graveId))];
  const names = await graveNames(locale, graveIds);
  const openAl = await db.select({ deviceId: alerts.deviceId }).from(alerts).where(ne(alerts.status, "resolved"));
  const rows: FleetRow[] = [];
  for (const d of ds) {
    const a = assigns.find((x) => x.deviceId === d.id);
    if (scope && (!a || !scope.includes(a.graveId))) continue;
    const tele = (d.lastTelemetry ?? {}) as Tele;
    rows.push({
      id: d.id,
      name: d.name,
      serial: d.serial,
      status: d.status,
      paused: d.paused,
      simulated: d.isSimulated,
      agentVersion: d.agentVersion,
      lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      connectivity: connectivityOf(d.lastSeenAt),
      graveId: a?.graveId ?? null,
      graveName: a ? (names.get(a.graveId) ?? null) : null,
      tele,
      paper: await paperEstimateFor(d.id, tele.paperSensor),
      openAlerts: openAl.filter((x) => x.deviceId === d.id).length,
    });
  }
  return rows;
}

export async function deviceDetail(id: string, locale: string) {
  const db = await getDb();
  const [d] = await db.select().from(devices).where(eq(devices.id, id));
  if (!d) return null;
  const since = new Date(Date.now() - 72 * 3600_000);
  const [telemetry, events, jobs, commands, creds, assigns, rolls, openAlerts] = await Promise.all([
    db.select({ at: deviceTelemetry.at, data: deviceTelemetry.data }).from(deviceTelemetry).where(and(eq(deviceTelemetry.deviceId, id), gt(deviceTelemetry.at, since))).orderBy(deviceTelemetry.at),
    db.select().from(deviceEvents).where(eq(deviceEvents.deviceId, id)).orderBy(desc(deviceEvents.occurredAt)).limit(40),
    db
      .select({ id: printJobs.id, status: printJobs.status, attempts: printJobs.attempts, confidence: printJobs.confidence, isTest: printJobs.isTest, lengthMm: printJobs.lengthMm, lastError: printJobs.lastError, createdAt: printJobs.createdAt, deliveredAt: printJobs.deliveredAt })
      .from(printJobs)
      .where(eq(printJobs.deviceId, id))
      .orderBy(desc(printJobs.createdAt))
      .limit(15),
    db.select().from(deviceCommands).where(eq(deviceCommands.deviceId, id)).orderBy(desc(deviceCommands.createdAt)).limit(15),
    db.select({ id: deviceCredentials.id, tokenPrefix: deviceCredentials.tokenPrefix, createdAt: deviceCredentials.createdAt, lastUsedAt: deviceCredentials.lastUsedAt, revokedAt: deviceCredentials.revokedAt }).from(deviceCredentials).where(eq(deviceCredentials.deviceId, id)).orderBy(desc(deviceCredentials.createdAt)),
    db.select().from(deviceAssignments).where(eq(deviceAssignments.deviceId, id)).orderBy(desc(deviceAssignments.assignedAt)),
    db.select().from(paperRolls).where(eq(paperRolls.deviceId, id)).orderBy(desc(paperRolls.installedAt)).limit(6),
    db.select().from(alerts).where(and(eq(alerts.deviceId, id), ne(alerts.status, "resolved"))).orderBy(desc(alerts.openedAt)),
  ]);
  const names = await graveNames(locale, [...new Set(assigns.map((a) => a.graveId))]);
  const tele = (d.lastTelemetry ?? {}) as Tele;
  return {
    device: d,
    connectivity: connectivityOf(d.lastSeenAt),
    tele,
    telemetry: telemetry.map((r) => ({ at: r.at.getTime(), data: r.data as Tele })),
    events,
    jobs,
    commands,
    creds,
    assigns: assigns.map((a) => ({ ...a, graveName: names.get(a.graveId) ?? null })),
    current: assigns.find((a) => !a.unassignedAt) ?? null,
    rolls,
    paper: await paperEstimateFor(id, tele.paperSensor),
    openAlerts,
  };
}

export async function listPairingCodes(locale: string) {
  const db = await getDb();
  const rows = await db
    .select({ id: devicePairingCodes.id, deviceName: devicePairingCodes.deviceName, graveId: devicePairingCodes.graveId, expiresAt: devicePairingCodes.expiresAt, usedAt: devicePairingCodes.usedAt, deviceId: devicePairingCodes.deviceId, createdAt: devicePairingCodes.createdAt })
    .from(devicePairingCodes)
    .orderBy(desc(devicePairingCodes.createdAt))
    .limit(20);
  const names = await graveNames(locale, [...new Set(rows.map((r) => r.graveId).filter(Boolean) as string[])]);
  return rows.map((r) => ({ ...r, graveName: r.graveId ? (names.get(r.graveId) ?? null) : null, state: r.usedAt ? ("used" as const) : r.expiresAt < new Date() ? ("expired" as const) : ("pending" as const) }));
}

export async function listAlerts(locale: string, scope: string[] | null, status: "active" | "open" | "acknowledged" | "resolved" | "all") {
  const db = await getDb();
  const conds: SQL[] = [];
  if (status === "active") conds.push(ne(alerts.status, "resolved"));
  else if (status !== "all") conds.push(eq(alerts.status, status));
  if (scope) conds.push(inArray(alerts.graveId, scope.length ? scope : ["00000000-0000-0000-0000-000000000000"]));
  const rows = await db.select().from(alerts).where(conds.length ? and(...conds) : undefined).orderBy(desc(alerts.openedAt)).limit(200);
  const ds = await db.select({ id: devices.id, name: devices.name, sim: devices.isSimulated }).from(devices);
  const names = await graveNames(locale, [...new Set(rows.map((r) => r.graveId).filter(Boolean) as string[])]);
  return rows.map((r) => ({ ...r, deviceName: ds.find((d) => d.id === r.deviceId)?.name ?? null, simulated: ds.find((d) => d.id === r.deviceId)?.sim ?? false, graveName: r.graveId ? (names.get(r.graveId) ?? null) : null }));
}

export async function listTickets(locale: string, scope: string[] | null, onlyOpen: boolean) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (onlyOpen) conds.push(inArray(maintenanceTickets.status, ["open", "in_progress", "waiting_parts"]));
  if (scope) conds.push(inArray(maintenanceTickets.graveId, scope.length ? scope : ["00000000-0000-0000-0000-000000000000"]));
  const rows = await db.select().from(maintenanceTickets).where(conds.length ? and(...conds) : undefined).orderBy(desc(maintenanceTickets.createdAt)).limit(200);
  const logs = rows.length ? await db.select().from(maintenanceLogs).where(inArray(maintenanceLogs.ticketId, rows.map((r) => r.id))).orderBy(desc(maintenanceLogs.createdAt)) : [];
  const us = await db.select({ id: users.id, email: users.email, name: users.displayName }).from(users);
  const ds = await db.select({ id: devices.id, name: devices.name }).from(devices);
  const names = await graveNames(locale, [...new Set(rows.map((r) => r.graveId).filter(Boolean) as string[])]);
  return rows.map((r) => ({
    ...r,
    graveName: r.graveId ? (names.get(r.graveId) ?? null) : null,
    deviceName: ds.find((d) => d.id === r.deviceId)?.name ?? null,
    assignee: us.find((u) => u.id === r.assigneeUserId) ?? null,
    logs: logs.filter((l) => l.ticketId === r.id).map((l) => ({ ...l, author: us.find((u) => u.id === l.authorUserId)?.name ?? us.find((u) => u.id === l.authorUserId)?.email ?? null })),
    overdue: !!r.dueAt && r.dueAt < new Date() && !["resolved", "closed"].includes(r.status),
  }));
}

/** People who can take a maintenance ticket. */
export async function assignableUsers() {
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.displayName, role: roleAssignments.role })
    .from(roleAssignments)
    .innerJoin(users, eq(users.id, roleAssignments.userId))
    .where(and(isNull(roleAssignments.revokedAt), isNull(users.deletedAt), inArray(roleAssignments.role, ["local_maintainer", "partner_manager", "admin", "super_admin"])));
  const seen = new Map<string, { id: string; label: string; role: string }>();
  for (const r of rows) if (!seen.has(r.id)) seen.set(r.id, { id: r.id, label: r.name ?? r.email, role: r.role });
  return [...seen.values()];
}

export async function activityFeed(locale: string, scope: string[] | null, filter: { deviceId?: string; type?: string }) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (filter.deviceId && /^[0-9a-f-]{36}$/i.test(filter.deviceId)) conds.push(eq(deviceEvents.deviceId, filter.deviceId));
  if (filter.type) conds.push(or(eq(deviceEvents.type, filter.type), eq(deviceEvents.type, `job.${filter.type}`))!);
  let deviceFilter: string[] | null = null;
  if (scope) {
    const as = await db.select({ deviceId: deviceAssignments.deviceId }).from(deviceAssignments).where(and(isNull(deviceAssignments.unassignedAt), inArray(deviceAssignments.graveId, scope.length ? scope : ["00000000-0000-0000-0000-000000000000"])));
    deviceFilter = as.map((a) => a.deviceId);
    conds.push(inArray(deviceEvents.deviceId, deviceFilter.length ? deviceFilter : ["00000000-0000-0000-0000-000000000000"]));
  }
  const rows = await db.select().from(deviceEvents).where(conds.length ? and(...conds) : undefined).orderBy(desc(deviceEvents.occurredAt)).limit(200);
  const ds = await db.select({ id: devices.id, name: devices.name, sim: devices.isSimulated }).from(devices);
  const types = await db.selectDistinct({ type: deviceEvents.type }).from(deviceEvents);
  void locale;
  return {
    rows: rows.map((r) => ({ ...r, deviceName: ds.find((d) => d.id === r.deviceId)?.name ?? "—", simulated: ds.find((d) => d.id === r.deviceId)?.sim ?? false })),
    devices: ds.filter((d) => !deviceFilter || deviceFilter.includes(d.id)),
    types: types.map((t) => t.type).sort(),
  };
}
