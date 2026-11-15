import "server-only";
import { createHmac } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import {
  deviceAssignments,
  deviceCommands,
  deviceConfig,
  deviceCredentials,
  deviceEvents,
  devicePairingCodes,
  devices,
  deviceTelemetry,
  paperRolls,
  printJobs,
  randomToken,
  secret,
  sha256,
} from "@kvittel/db";
import { estimatePaper, needsPaperAlert } from "@kvittel/print-layout";
import { audit } from "./audit";
import { getDb } from "./db";
import { openAlert, resolveAlert } from "./alerts";
import { log } from "./log";

export const ONLINE_WINDOW_MS = 2 * 60_000;
export const OFFLINE_ALERT_MS = 30 * 60_000;

export type DeviceRow = typeof devices.$inferSelect;

/** Bearer-token authentication for device endpoints. Tokens are stored hashed. */
export async function authenticateDevice(req: Request): Promise<DeviceRow | null> {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer (kvd_[A-Za-z0-9_-]{20,})$/.exec(h);
  if (!m) return null;
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select({ device: devices, cred: deviceCredentials })
    .from(deviceCredentials)
    .innerJoin(devices, eq(devices.id, deviceCredentials.deviceId))
    .where(and(eq(deviceCredentials.tokenHash, sha256(m[1]!)), or(isNull(deviceCredentials.revokedAt), gt(deviceCredentials.revokedAt, now))))
    .limit(1);
  const r = rows[0];
  if (!r || r.device.status === "revoked" || r.device.status === "retired") return null;
  if (!r.cred.lastUsedAt || now.getTime() - r.cred.lastUsedAt.getTime() > 60_000)
    await db.update(deviceCredentials).set({ lastUsedAt: now }).where(eq(deviceCredentials.id, r.cred.id));
  return r.device;
}

/** Per-device HMAC key for command signatures, derived from the server secret. */
export function commandKey(deviceId: string): Buffer {
  return createHmac("sha256", secret("DEVICE_COMMAND_SECRET")).update(`cmdkey:${deviceId}`).digest();
}

export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalJson).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .filter((k) => o[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
    .join(",")}}`;
}

export function signCommand(deviceId: string, c: { id: string; type: string; expiresAt: string; payload: unknown }): string {
  const msg = `${c.id}.${c.type}.${c.expiresAt}.${sha256(canonicalJson(c.payload ?? {}))}`;
  return createHmac("sha256", commandKey(deviceId)).update(msg).digest("hex");
}

export async function currentAssignment(deviceId: string) {
  const db = await getDb();
  const [a] = await db
    .select()
    .from(deviceAssignments)
    .where(and(eq(deviceAssignments.deviceId, deviceId), isNull(deviceAssignments.unassignedAt)))
    .orderBy(desc(deviceAssignments.assignedAt))
    .limit(1);
  return a ?? null;
}

export async function currentRoll(deviceId: string) {
  const db = await getDb();
  const [r] = await db.select().from(paperRolls).where(and(eq(paperRolls.deviceId, deviceId), isNull(paperRolls.removedAt))).orderBy(desc(paperRolls.installedAt)).limit(1);
  return r ?? null;
}

/** Rolling average daily usage over the last 14 days from delivered print lengths. */
export async function avgDailyUsageMm(deviceId: string): Promise<number | null> {
  const db = await getDb();
  const since = new Date(Date.now() - 14 * 86400000);
  const [r] = await db
    .select({ total: sql<number>`coalesce(sum(${printJobs.lengthMm}), 0)`, first: sql<Date | null>`min(${printJobs.createdAt})` })
    .from(printJobs)
    .where(and(eq(printJobs.deviceId, deviceId), gt(printJobs.createdAt, since), inArray(printJobs.status, ["delivered", "printed", "cut", "chute_confirmed", "uncertain"])));
  const total = Number(r?.total ?? 0);
  if (!total) return null;
  return total / 14;
}

export async function paperEstimateFor(deviceId: string, nearEnd: string | undefined) {
  const roll = await currentRoll(deviceId);
  if (!roll) return null;
  return estimatePaper({
    spec: { outerDiameterMm: roll.outerDiameterMm, coreDiameterMm: roll.coreDiameterMm, paperThicknessMm: roll.thicknessMm, nominalLengthMm: roll.nominalLengthMm ?? undefined },
    usedMm: roll.usedMm,
    calibrationFactor: roll.calibrationFactor ?? undefined,
    nearEndSensor: (nearEnd as "ok" | "near_end" | "unsupported" | "unknown" | undefined) ?? "unknown",
    avgDailyUsageMm: await avgDailyUsageMm(deviceId),
  });
}

interface Telemetry {
  power?: string;
  paperSensor?: string;
  cover?: string;
  cutter?: string;
  chuteSensor?: string;
  capabilities?: Record<string, string>;
  [k: string]: unknown;
}

export async function handleHeartbeat(device: DeviceRow, body: { seq?: number; agentVersion?: string; bootId?: string; telemetry?: Telemetry }) {
  const db = await getDb();
  const now = new Date();
  const t: Telemetry = { ...(body.telemetry ?? {}) };
  // Store snapshot + sampled history (≤ 1 row / minute)
  await db.update(devices).set({ lastSeenAt: now, lastTelemetry: { ...t, bootId: body.bootId, seq: body.seq }, agentVersion: body.agentVersion?.slice(0, 40) ?? device.agentVersion, updatedAt: now }).where(eq(devices.id, device.id));
  const [last] = await db.select({ at: deviceTelemetry.at }).from(deviceTelemetry).where(eq(deviceTelemetry.deviceId, device.id)).orderBy(desc(deviceTelemetry.at)).limit(1);
  if (!last || now.getTime() - last.at.getTime() > 60_000) await db.insert(deviceTelemetry).values({ deviceId: device.id, at: now, data: t });

  const assignment = await currentAssignment(device.id);
  const graveId = assignment?.graveId ?? null;
  await resolveAlert("device_offline", { deviceId: device.id });
  await resolveAlert("heartbeat_missed", { deviceId: device.id });

  // Sensor-driven alerts. Power loss is only asserted when hardware supports it.
  if (t.capabilities?.power === "supported" && t.power === "battery") await openAlert("ac_power_lost", { deviceId: device.id, graveId }, { batteryPct: t.batteryPct });
  else if (t.power === "ac") await resolveAlert("ac_power_lost", { deviceId: device.id });
  if (t.cover === "open") await openAlert("cover_open", { deviceId: device.id, graveId });
  else if (t.cover === "closed") await resolveAlert("cover_open", { deviceId: device.id });
  if (t.cutter === "fault") await openAlert("cutter_fault", { deviceId: device.id, graveId });
  if (t.chuteSensor === "fault") await openAlert("chute_sensor_fault", { deviceId: device.id, graveId });
  else if (t.chuteSensor === "ok") await resolveAlert("chute_sensor_fault", { deviceId: device.id });
  if (t.paperSensor === "paper_end") await openAlert("paper_end", { deviceId: device.id, graveId });
  else if (t.paperSensor === "ok" || t.paperSensor === "near_end") await resolveAlert("paper_end", { deviceId: device.id });

  const est = await paperEstimateFor(device.id, t.paperSensor);
  if (est) {
    const verdict = needsPaperAlert(est, 4);
    if (verdict.alert) await openAlert("paper_low", { deviceId: device.id, graveId }, { remainingPct: est.remainingPct, daysToEmpty: est.daysToEmpty, reason: verdict.reason });
  }

  // Deliver pending commands (marked delivered; device reports result)
  await db.update(deviceCommands).set({ status: "expired" }).where(and(eq(deviceCommands.deviceId, device.id), inArray(deviceCommands.status, ["pending", "delivered"]), lt(deviceCommands.expiresAt, now)));
  const cmds = await db.select().from(deviceCommands).where(and(eq(deviceCommands.deviceId, device.id), eq(deviceCommands.status, "pending"))).orderBy(deviceCommands.createdAt).limit(10);
  if (cmds.length) await db.update(deviceCommands).set({ status: "delivered", deliveredAt: now }).where(inArray(deviceCommands.id, cmds.map((c) => c.id)));

  const [cfg] = await db.select().from(deviceConfig).where(eq(deviceConfig.deviceId, device.id));
  let jobAvailable = false;
  if (graveId && !device.paused) {
    const [j] = await db
      .select({ id: printJobs.id })
      .from(printJobs)
      .where(and(eq(printJobs.graveId, graveId), or(eq(printJobs.status, "queued"), and(eq(printJobs.status, "scheduled"), lt(printJobs.notBefore, now)), and(eq(printJobs.isTest, true), eq(printJobs.deviceId, device.id), eq(printJobs.status, "queued")))))
      .limit(1);
    jobAvailable = !!j;
  }
  return {
    serverTime: now.toISOString(),
    paused: device.paused,
    config: { version: cfg?.version ?? 1, ...(cfg?.config ?? { heartbeatSec: 15, leaseSec: 90, chuteTimeoutMs: 8000 }) },
    jobAvailable,
    commands: cmds.map((c) => ({ id: c.id, type: c.type, payload: c.payload ?? {}, expiresAt: c.expiresAt.toISOString(), signature: c.signature })),
  };
}

export type CommandType = (typeof deviceCommands.$inferInsert)["type"];

export async function issueCommand(deviceId: string, type: CommandType, payload: Record<string, unknown> | null, issuedBy: string | null) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 10 * 60000);
  const expiresIso = expiresAt.toISOString();
  const signature = signCommand(deviceId, { id, type, expiresAt: expiresIso, payload: payload ?? {} });
  await db.insert(deviceCommands).values({ id, deviceId, type, payload: payload ?? {}, signature, issuedBy, expiresAt });
  if (type === "pause" || type === "resume") await db.update(devices).set({ paused: type === "pause" }).where(eq(devices.id, deviceId));
  if (type === "test_print") {
    const assignment = await currentAssignment(deviceId);
    if (assignment) {
      // A test print is a real (non-customer) print job pinned to this device.
      await db.insert(printJobs).values({ graveId: assignment.graveId, deviceId, commandId: `test_${randomToken(12)}`, status: "queued", isTest: true }).catch(() => undefined);
    }
  }
  await audit({ actorUserId: issuedBy, action: `device.command.${type}`, targetType: "device", targetId: deviceId });
  return id;
}

export async function recordCommandResult(device: DeviceRow, commandId: string, status: "succeeded" | "failed", result: Record<string, unknown> | undefined) {
  const db = await getDb();
  await db
    .update(deviceCommands)
    .set({ status, result: (log.redact(result ?? {}) as Record<string, unknown>) ?? {}, completedAt: new Date() })
    .where(and(eq(deviceCommands.id, commandId), eq(deviceCommands.deviceId, device.id)));
}

export async function recordDeviceEvents(device: DeviceRow, events: Array<{ eventUid: string; type: string; severity?: string; at?: string; data?: Record<string, unknown> }>) {
  const db = await getDb();
  const assignment = await currentAssignment(device.id);
  for (const e of events.slice(0, 100)) {
    const sev = e.severity === "critical" || e.severity === "warning" ? e.severity : "info";
    const ins = await db
      .insert(deviceEvents)
      .values({ deviceId: device.id, eventUid: String(e.eventUid).slice(0, 80), type: String(e.type).slice(0, 40), severity: sev, data: log.redact(e.data ?? {}) as Record<string, unknown>, occurredAt: e.at ? new Date(e.at) : new Date() })
      .onConflictDoNothing()
      .returning({ id: deviceEvents.id });
    if (!ins.length) continue;
    const ids = { deviceId: device.id, graveId: assignment?.graveId };
    if (e.type === "power_lost") await openAlert("ac_power_lost", ids);
    if (e.type === "power_restored") await resolveAlert("ac_power_lost", ids);
    if (e.type === "cover_open") await openAlert("cover_open", ids);
    if (e.type === "cover_closed") await resolveAlert("cover_open", ids);
    if (e.type === "paper_end") await openAlert("paper_end", ids);
    if (e.type === "cutter_fault") await openAlert("cutter_fault", ids);
    if (e.type === "chute_sensor_fault") await openAlert("chute_sensor_fault", ids);
  }
}

/* ───────────── pairing / provisioning ───────────── */

const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
function pairingCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const s = [...bytes].map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

export async function createPairingCode(input: { graveId: string; deviceName: string; createdBy: string }) {
  const db = await getDb();
  const code = pairingCode();
  await db.insert(devicePairingCodes).values({ codeHash: sha256(code), graveId: input.graveId, deviceName: input.deviceName, printerProfileId: "thermal-58mm-203dpi", createdBy: input.createdBy, expiresAt: new Date(Date.now() + 30 * 60000) });
  await audit({ actorUserId: input.createdBy, action: "device.pairing_code.created", targetType: "grave", targetId: input.graveId });
  return { code, expiresAt: new Date(Date.now() + 30 * 60000).toISOString() };
}

export async function pairDevice(input: { pairingCode: string; hardwareId: string; agentVersion?: string; simulated?: boolean }) {
  const db = await getDb();
  const code = input.pairingCode.trim().toUpperCase();
  const [pc] = await db.select().from(devicePairingCodes).where(eq(devicePairingCodes.codeHash, sha256(code))).limit(1);
  if (!pc) return { error: "invalid_code" as const };
  if (pc.usedAt || pc.expiresAt < new Date()) return { error: "code_expired_or_used" as const };
  const token = `kvd_${randomToken(24)}`;
  const serial = input.hardwareId.slice(0, 80);
  const device = await db.transaction(async (tx) => {
    const claimed = await tx.update(devicePairingCodes).set({ usedAt: new Date() }).where(and(eq(devicePairingCodes.id, pc.id), isNull(devicePairingCodes.usedAt))).returning();
    if (!claimed.length) return null;
    const existing = await tx.select().from(devices).where(eq(devices.serial, serial)).limit(1);
    let d = existing[0];
    if (d) {
      // Re-pair (e.g. SD card replaced): revoke old credentials, keep history.
      await tx.update(deviceCredentials).set({ revokedAt: new Date() }).where(and(eq(deviceCredentials.deviceId, d.id), isNull(deviceCredentials.revokedAt)));
      await tx.update(devices).set({ status: "active", name: pc.deviceName, updatedAt: new Date() }).where(eq(devices.id, d.id));
    } else {
      [d] = await tx.insert(devices).values({ serial, name: pc.deviceName, status: "active", printerProfileId: pc.printerProfileId, agentVersion: input.agentVersion?.slice(0, 40), isSimulated: !!input.simulated }).returning();
    }
    await tx.insert(deviceCredentials).values({ deviceId: d!.id, tokenHash: sha256(token), tokenPrefix: token.slice(0, 10) });
    if (pc.graveId) {
      await tx.update(deviceAssignments).set({ unassignedAt: new Date() }).where(and(eq(deviceAssignments.deviceId, d!.id), isNull(deviceAssignments.unassignedAt)));
      await tx.insert(deviceAssignments).values({ deviceId: d!.id, graveId: pc.graveId, assertedBy: pc.createdBy, note: "paired via code" });
    }
    await tx.insert(deviceConfig).values({ deviceId: d!.id, config: { heartbeatSec: 15, leaseSec: 90, chuteTimeoutMs: 8000 } }).onConflictDoNothing();
    await tx.update(devicePairingCodes).set({ deviceId: d!.id }).where(eq(devicePairingCodes.id, pc.id));
    return d!;
  });
  if (!device) return { error: "code_expired_or_used" as const };
  const roll = await currentRoll(device.id);
  if (!roll) await db.insert(paperRolls).values({ deviceId: device.id, outerDiameterMm: 40, coreDiameterMm: 12, thicknessMm: 0.06 });
  await audit({ actorKind: "device", action: "device.paired", targetType: "device", targetId: device.id });
  return { deviceId: device.id, token, commandKey: commandKey(device.id).toString("base64"), serverTime: new Date().toISOString(), config: { heartbeatSec: 15, leaseSec: 90, chuteTimeoutMs: 8000 } };
}

export async function rotateToken(device: DeviceRow) {
  const db = await getDb();
  const token = `kvd_${randomToken(24)}`;
  await db.update(deviceCredentials).set({ revokedAt: new Date(Date.now() + 10 * 60000) }).where(and(eq(deviceCredentials.deviceId, device.id), isNull(deviceCredentials.revokedAt)));
  await db.insert(deviceCredentials).values({ deviceId: device.id, tokenHash: sha256(token), tokenPrefix: token.slice(0, 10) });
  await audit({ actorKind: "device", action: "device.token.rotated", targetType: "device", targetId: device.id });
  return { token, serverTime: new Date().toISOString() };
}

export async function revokeDevice(deviceId: string, by: string) {
  const db = await getDb();
  await db.update(deviceCredentials).set({ revokedAt: new Date() }).where(and(eq(deviceCredentials.deviceId, deviceId), isNull(deviceCredentials.revokedAt)));
  await db.update(devices).set({ status: "revoked", updatedAt: new Date() }).where(eq(devices.id, deviceId));
  await audit({ actorUserId: by, action: "device.revoked", targetType: "device", targetId: deviceId });
}

/** Called by the background worker: offline detection based on missed heartbeats. Cause is unknown by definition. */
export async function evaluateFleetHealth() {
  const db = await getDb();
  const all = await db.select().from(devices).where(inArray(devices.status, ["active", "maintenance"]));
  const now = Date.now();
  for (const d of all) {
    const since = d.lastSeenAt ? now - d.lastSeenAt.getTime() : Infinity;
    const a = await currentAssignment(d.id);
    if (since > OFFLINE_ALERT_MS) await openAlert("device_offline", { deviceId: d.id, graveId: a?.graveId }, { lastSeenAt: d.lastSeenAt?.toISOString() ?? null });
    else if (since > ONLINE_WINDOW_MS) await openAlert("heartbeat_missed", { deviceId: d.id, graveId: a?.graveId }, { lastSeenAt: d.lastSeenAt?.toISOString() ?? null });
  }
}
