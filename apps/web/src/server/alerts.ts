import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { alerts } from "@kvittel/db";
import { getDb } from "./db";
import { log } from "./log";

export type AlertKind =
  | "heartbeat_missed"
  | "device_offline"
  | "paper_low"
  | "paper_end"
  | "cover_open"
  | "cutter_fault"
  | "print_uncertain"
  | "ac_power_lost"
  | "chute_sensor_fault"
  | "payment_mismatch";

const SEVERITY: Record<AlertKind, "info" | "warning" | "critical"> = {
  heartbeat_missed: "warning",
  device_offline: "critical",
  paper_low: "warning",
  paper_end: "critical",
  cover_open: "critical",
  cutter_fault: "critical",
  print_uncertain: "critical",
  ac_power_lost: "warning",
  chute_sensor_fault: "warning",
  payment_mismatch: "critical",
};

/** Opens an alert unless one with the same dedupe key is already open/acknowledged. */
export async function openAlert(kind: AlertKind, ids: { deviceId?: string | null; graveId?: string | null; key?: string }, data?: Record<string, unknown>) {
  const db = await getDb();
  const dedupeKey = `${kind}:${ids.key ?? ids.deviceId ?? ids.graveId ?? "global"}`;
  const r = await db
    .insert(alerts)
    .values({ kind, severity: SEVERITY[kind], deviceId: ids.deviceId ?? null, graveId: ids.graveId ?? null, dedupeKey, data })
    .onConflictDoNothing()
    .returning({ id: alerts.id });
  if (r.length) log.warn("alert.opened", { kind, deviceId: ids.deviceId });
  return r[0]?.id ?? null;
}

export async function resolveAlert(kind: AlertKind, ids: { deviceId?: string | null; graveId?: string | null; key?: string }) {
  const db = await getDb();
  const dedupeKey = `${kind}:${ids.key ?? ids.deviceId ?? ids.graveId ?? "global"}`;
  await db.update(alerts).set({ status: "resolved", resolvedAt: new Date() }).where(and(eq(alerts.dedupeKey, dedupeKey), ne(alerts.status, "resolved")));
}
