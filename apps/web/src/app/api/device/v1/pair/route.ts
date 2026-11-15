import { z } from "zod";
import { json } from "@/server/device-http";
import { pairDevice } from "@/server/devices";
import { rateLimit } from "@/server/ratelimit";

const schema = z.object({ pairingCode: z.string().min(6).max(20), hardwareId: z.string().min(3).max(120), agentVersion: z.string().max(40).optional(), printerModel: z.string().max(80).optional() });

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`pair:${ip}`, 10, 10 * 60_000).ok) return json({ error: "rate_limited" }, 429);
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "invalid_request" }, 400);
  const r = await pairDevice(parsed.data);
  if ("error" in r) return json({ error: r.error }, r.error === "invalid_code" ? 400 : 410);
  return json(r);
}
