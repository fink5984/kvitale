import { createCanvas } from "@napi-rs/canvas";
import { describe, expect, it } from "vitest";
import { sanitizePhoto } from "../src/node";

describe("sanitizePhoto (grave photos)", () => {
  it("re-encodes to WebP, caps the long side and keeps aspect ratio", async () => {
    const c = createCanvas(3000, 2000);
    const x = c.getContext("2d");
    x.fillStyle = "#c9a25a";
    x.fillRect(0, 0, 3000, 2000);
    const out = await sanitizePhoto(c.toBuffer("image/jpeg"));
    expect(out.mime).toBe("image/webp");
    expect(out.data.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect([out.width, out.height]).toEqual([2000, 1333]);
  });
  it("does not upscale small images", async () => {
    const c = createCanvas(92, 92);
    const out = await sanitizePhoto(c.toBuffer("image/png"));
    expect([out.width, out.height]).toEqual([92, 92]);
  });
  it("rejects non-images", async () => {
    await expect(sanitizePhoto(Buffer.from("<script>alert(1)</script>"))).rejects.toBeTruthy();
  });
});
