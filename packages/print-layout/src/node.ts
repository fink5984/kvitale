/**
 * Server-side rendering of kvittel rasters with @napi-rs/canvas (Skia).
 * Uses the same layout engine + the same TTF files the browser preview loads.
 */
import { createCanvas, GlobalFonts, loadImage, type Image } from "@napi-rs/canvas";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { layoutKvittel, PROFILE_58MM_203DPI } from "./layout";
import { createCanvasMeasurer, renderPage, type Ctx2D } from "./render";
import { packRgba, type PackedRaster } from "./raster";
import type { KvittelContent, KvittelLayout, LayoutOptions, PrinterProfile } from "./types";

let fontsReady = false;

export function fontsDir(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "fonts");
}

export function registerPrintFonts(dir = process.env.KVITTEL_FONTS_DIR || fontsDir()): void {
  if (fontsReady) return;
  const f = (n: string) => path.join(dir, n);
  GlobalFonts.registerFromPath(f("NotoSerifHebrew-Regular.ttf"), "KvittelSerifHebrew");
  GlobalFonts.registerFromPath(f("NotoSerifHebrew-Bold.ttf"), "KvittelSerifHebrew");
  GlobalFonts.registerFromPath(f("NotoSerif-Regular.ttf"), "KvittelSerif");
  GlobalFonts.registerFromPath(f("NotoSerif-Bold.ttf"), "KvittelSerif");
  GlobalFonts.registerFromPath(f("NotoSerif-Italic.ttf"), "KvittelSerif");
  fontsReady = true;
}

export interface RenderedKvittel {
  layout: KvittelLayout;
  rasters: PackedRaster[];
  pngs: Buffer[];
}

export async function renderKvittel(
  content: KvittelContent,
  opts: LayoutOptions & { profile?: PrinterProfile; images?: Record<string, Buffer> } = {},
): Promise<RenderedKvittel> {
  registerPrintFonts();
  const profile = opts.profile ?? PROFILE_58MM_203DPI;
  const probe = createCanvas(8, 8).getContext("2d") as unknown as Ctx2D;
  const layout = layoutKvittel(content, profile, createCanvasMeasurer(probe), opts);
  const images: Record<string, Image> = {};
  for (const [k, buf] of Object.entries(opts.images ?? {})) images[k] = await loadImage(buf);
  const rasters: PackedRaster[] = [];
  const pngs: Buffer[] = [];
  for (const page of layout.pages) {
    const canvas = createCanvas(layout.widthDots, page.heightDots);
    const ctx = canvas.getContext("2d");
    renderPage(ctx as unknown as Ctx2D, page, layout.widthDots, { images });
    const img = ctx.getImageData(0, 0, layout.widthDots, page.heightDots);
    const hasImage = page.ops.some((o) => o.kind === "image");
    const r = packRgba(img.data, layout.widthDots, page.heightDots, hasImage ? "dither" : "threshold");
    rasters.push(r);
    pngs.push(rasterToPng(r));
  }
  return { layout, rasters, pngs };
}

export function rasterToPng(r: PackedRaster): Buffer {
  const canvas = createCanvas(r.width, r.height);
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(r.width, r.height);
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++) {
      const on = (r.data[y * r.bytesPerRow + (x >> 3)]! & (0x80 >> (x & 7))) !== 0;
      const o = (y * r.width + x) * 4;
      const v = on ? 0 : 255;
      img.data[o] = v;
      img.data[o + 1] = v;
      img.data[o + 2] = v;
      img.data[o + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  return canvas.toBuffer("image/png");
}

/**
 * Re-encode an uploaded image: decodes with Skia and writes a fresh PNG,
 * dropping EXIF/metadata and any trailing payload. Rejects non-images.
 */
export async function sanitizeImage(buf: Buffer, maxSide = 2400): Promise<{ png: Buffer; width: number; height: number }> {
  const img = await loadImage(buf);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return { png: canvas.toBuffer("image/png"), width: w, height: h };
}

/**
 * Public photo pipeline (grave photos): decode → resize → re-encode as WebP.
 * Re-encoding drops EXIF/GPS metadata and any non-image payload.
 */
export async function sanitizePhoto(buf: Buffer, maxSide = 2000, quality = 82): Promise<{ data: Buffer; mime: "image/webp"; width: number; height: number }> {
  const img = await loadImage(buf);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  return { data: canvas.toBuffer("image/webp", quality), mime: "image/webp", width: w, height: h };
}
