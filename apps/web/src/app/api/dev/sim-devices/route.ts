import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { repoRoot } from "@kvittel/db";
import { getSession } from "@/server/auth/session";
import { commandKey } from "@/server/devices";
import { env } from "@/server/env";

/**
 * DEMO-only: credentials of the seeded *simulated* devices for the in-browser Device Lab.
 * 404 unless demo mode is on and the caller holds lab.use. Never exposes real devices.
 */
export async function GET() {
  if (!env.demoMode) return new NextResponse(null, { status: 404 });
  const s = await getSession();
  if (!s || !s.permissions.has("lab.use")) return new NextResponse(null, { status: 404 });
  let list: Array<{ deviceId: string; serial: string; token: string; grave: string; name: string }> = [];
  try {
    list = JSON.parse(await readFile(path.join(repoRoot(), ".data", "sim-devices.json"), "utf8"));
  } catch {
    list = [];
  }
  return NextResponse.json(
    { devices: list.map((d) => ({ ...d, commandKey: commandKey(d.deviceId).toString("base64") })) },
    { headers: { "cache-control": "no-store" } },
  );
}
