import { z } from "zod";
import { json, withDevice } from "@/server/device-http";
import { handleJobEvent, JOB_EVENT_TYPES } from "@/server/queue";

const schema = z.object({
  leaseId: z.string().min(4).max(80),
  eventUid: z.string().min(4).max(80),
  type: z.enum(JOB_EVENT_TYPES),
  at: z.string().max(40).optional(),
  data: z.object({ error: z.string().max(40).optional(), phase: z.string().max(20).optional(), reason: z.string().max(80).optional() }).partial().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return json({ error: "not_found" }, 404);
  return withDevice(req, async (device, body) => {
    const parsed = schema.safeParse(body);
    if (!parsed.success) return json({ error: "invalid_request" }, 400);
    const r = await handleJobEvent(device, jobId, parsed.data);
    if ("error" in r) return json(r, 404);
    return json({ ...r, serverTime: new Date().toISOString() });
  });
}
