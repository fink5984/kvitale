import "server-only";
import { auditLogs } from "@kvittel/db";
import { getDb } from "./db";

/** Append-only audit trail. NEVER pass kvittel content in meta. */
export async function audit(entry: {
  actorUserId?: string | null;
  actorKind?: "user" | "device" | "system" | "webhook";
  action: string;
  targetType?: string;
  targetId?: string;
  meta?: Record<string, unknown>;
  reason?: string;
}) {
  const db = await getDb();
  await db.insert(auditLogs).values({
    actorUserId: entry.actorUserId ?? null,
    actorKind: entry.actorKind ?? "user",
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    meta: entry.meta,
    reason: entry.reason,
  });
}
