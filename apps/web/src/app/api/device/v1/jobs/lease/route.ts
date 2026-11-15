import { json, withDevice } from "@/server/device-http";
import { leaseJob } from "@/server/queue";

export async function POST(req: Request) {
  return withDevice(req, async (device) => {
    const job = await leaseJob(device);
    if (!job) return new Response(null, { status: 204 });
    return json({ job, serverTime: new Date().toISOString() });
  });
}
