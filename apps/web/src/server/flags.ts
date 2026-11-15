import "server-only";
import { featureFlags } from "@kvittel/db";
import { getDb } from "./db";

export async function getFlags(): Promise<Record<string, boolean>> {
  const db = await getDb();
  const rows = await db.select().from(featureFlags);
  return Object.fromEntries(rows.map((r) => [r.key, r.enabled]));
}
