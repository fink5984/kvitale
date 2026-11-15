import { json, withDevice } from "@/server/device-http";
import { handleHeartbeat } from "@/server/devices";
import { sweepExpiredLeases } from "@/server/queue";

export async function POST(req: Request) {
  return withDevice(req, async (device, body) => {
    await sweepExpiredLeases();
    return json(await handleHeartbeat(device, body as Parameters<typeof handleHeartbeat>[1]));
  });
}
