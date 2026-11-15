import "server-only";
import { NextResponse } from "next/server";
import { authenticateDevice, type DeviceRow } from "./devices";
import { rateLimit } from "./ratelimit";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });

export async function withDevice(req: Request, fn: (d: DeviceRow, body: Record<string, unknown>) => Promise<Response>) {
  const device = await authenticateDevice(req);
  if (!device) return json({ error: "unauthorized" }, 401);
  const rl = rateLimit(`dev:${device.id}`, 240, 60_000);
  if (!rl.ok) return json({ error: "rate_limited" }, 429);
  let body: Record<string, unknown> = {};
  try {
    const text = await req.text();
    if (text.length > 64_000) return json({ error: "payload_too_large" }, 413);
    body = text ? JSON.parse(text) : {};
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  return fn(device, body);
}
