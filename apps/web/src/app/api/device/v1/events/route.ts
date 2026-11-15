import { z } from "zod";
import { json, withDevice } from "@/server/device-http";
import { recordDeviceEvents } from "@/server/devices";

const schema = z.object({
  events: z
    .array(z.object({ eventUid: z.string().min(4).max(80), type: z.string().min(2).max(40), severity: z.string().max(10).optional(), at: z.string().max(40).optional(), data: z.record(z.string(), z.unknown()).optional() }))
    .max(100),
});

export async function POST(req: Request) {
  return withDevice(req, async (device, body) => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) return json({ error: "invalid_request" }, 400);
    await recordDeviceEvents(device, parsed.data.events);
    return json({ ok: true, serverTime: new Date().toISOString() });
  });
}
