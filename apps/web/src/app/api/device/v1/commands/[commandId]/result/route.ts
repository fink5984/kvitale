import { z } from "zod";
import { json, withDevice } from "@/server/device-http";
import { recordCommandResult } from "@/server/devices";

const schema = z.object({ status: z.enum(["succeeded", "failed"]), result: z.record(z.string(), z.unknown()).optional() });

export async function POST(req: Request, ctx: { params: Promise<{ commandId: string }> }) {
  const { commandId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(commandId)) return json({ error: "not_found" }, 404);
  return withDevice(req, async (device, body) => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) return json({ error: "invalid_request" }, 400);
    await recordCommandResult(device, commandId, parsed.data.status, parsed.data.result);
    return json({ ok: true });
  });
}
