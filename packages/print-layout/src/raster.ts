/**
 * 1-bit raster helpers for thermal printers.
 * Packed format: MSB-first, 1 = black dot, rows padded to whole bytes —
 * the format consumed by ESC/POS `GS v 0`.
 */

export interface PackedRaster {
  width: number;
  height: number;
  bytesPerRow: number;
  data: Uint8Array;
}

/** RGBA → luminance, then threshold (text) or Floyd–Steinberg (images). */
export function packRgba(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  mode: "threshold" | "dither" = "threshold",
  threshold = 150,
): PackedRaster {
  const lum = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const a = rgba[i * 4 + 3]! / 255;
    const r = rgba[i * 4]!;
    const g = rgba[i * 4 + 1]!;
    const b = rgba[i * 4 + 2]!;
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[i] = l * a + 255 * (1 - a);
  }
  if (mode === "dither") {
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const old = lum[i]!;
        const nv = old < 128 ? 0 : 255;
        const err = old - nv;
        lum[i] = nv;
        if (x + 1 < width) lum[i + 1]! += (err * 7) / 16;
        if (y + 1 < height) {
          if (x > 0) lum[i + width - 1]! += (err * 3) / 16;
          lum[i + width]! += (err * 5) / 16;
          if (x + 1 < width) lum[i + width + 1]! += err / 16;
        }
      }
  }
  const bytesPerRow = Math.ceil(width / 8);
  const data = new Uint8Array(bytesPerRow * height);
  const t = mode === "dither" ? 128 : threshold;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (lum[y * width + x]! < t) data[y * bytesPerRow + (x >> 3)]! |= 0x80 >> (x & 7);
    }
  return { width, height, bytesPerRow, data };
}

export function unpackToRgba(r: PackedRaster, ink = [20, 20, 20], paper = [255, 255, 255]): Uint8ClampedArray {
  const out = new Uint8ClampedArray(r.width * r.height * 4);
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++) {
      const on = (r.data[y * r.bytesPerRow + (x >> 3)]! & (0x80 >> (x & 7))) !== 0;
      const c = on ? ink : paper;
      const o = (y * r.width + x) * 4;
      out[o] = c[0]!;
      out[o + 1] = c[1]!;
      out[o + 2] = c[2]!;
      out[o + 3] = 255;
    }
  return out;
}

/** Count of black dots — used for thermal head duty estimates and test assertions. */
export function inkCoverage(r: PackedRaster): number {
  let n = 0;
  for (const b of r.data) {
    let v = b;
    while (v) {
      n += v & 1;
      v >>= 1;
    }
  }
  return n / (r.width * r.height);
}

/**
 * ESC/POS `GS v 0` raster bit image, chunked into bands to respect printer
 * buffer limits. Feed and cut are NOT included: the device agent issues them
 * separately so it can report each step. Cutter commands vary by model and
 * must be verified on the real hardware before use.
 */
export function escposRaster(r: PackedRaster, bandRows = 256): Uint8Array {
  const parts: number[] = [0x1b, 0x40]; // ESC @ init
  for (let y0 = 0; y0 < r.height; y0 += bandRows) {
    const rows = Math.min(bandRows, r.height - y0);
    parts.push(0x1d, 0x76, 0x30, 0x00, r.bytesPerRow & 0xff, (r.bytesPerRow >> 8) & 0xff, rows & 0xff, (rows >> 8) & 0xff);
    const slice = r.data.subarray(y0 * r.bytesPerRow, (y0 + rows) * r.bytesPerRow);
    for (const b of slice) parts.push(b);
  }
  return Uint8Array.from(parts);
}

export function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Stable content hash of a raster (FNV-1a 32) — lets device and server agree on what was printed without content in logs. */
export function rasterDigest(r: PackedRaster): string {
  let h = 0x811c9dc5;
  for (const b of r.data) {
    h ^= b;
    h = Math.imul(h, 0x01000193);
  }
  return `${r.width}x${r.height}-${(h >>> 0).toString(16).padStart(8, "0")}`;
}
