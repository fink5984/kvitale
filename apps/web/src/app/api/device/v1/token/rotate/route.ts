import { json, withDevice } from "@/server/device-http";
import { rotateToken } from "@/server/devices";

export async function POST(req: Request) {
  return withDevice(req, async (device) => json(await rotateToken(device)));
}
