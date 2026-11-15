import { NextResponse } from "next/server";
import { kvittelFiles, randomToken, sha256 } from "@kvittel/db";
import { sanitizeImage } from "@kvittel/print-layout/node";
import { getDb } from "@/server/db";
import { env } from "@/server/env";
import { rateLimit } from "@/server/ratelimit";
import { storage } from "@/server/storage";

const MAX = 8 * 1024 * 1024;

function sniff(b: Buffer): "image/png" | "image/jpeg" | null {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

/** Handwritten kvittel upload: type sniffing, size cap, decode + re-encode (metadata stripped), encrypted at rest. */
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(env.appUrl).host && new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "bad_origin" }, { status: 403 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`upload:${ip}`, 20, 3600000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > MAX + 64_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0 || file.size > MAX) return NextResponse.json({ error: "invalid_file" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniff(buf)) return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
  let clean;
  try {
    clean = await sanitizeImage(buf, 2400);
  } catch {
    return NextResponse.json({ error: "decode_failed" }, { status: 400 });
  }
  const ref = `hw_${randomToken(16).replace(/[^A-Za-z0-9_-]/g, "")}`;
  await storage.put(`handwriting/${ref}`, clean.png);
  const db = await getDb();
  await db.insert(kvittelFiles).values({ uploadToken: ref, storageKey: `handwriting/${ref}`, mime: "image/png", sizeBytes: clean.png.length, sha256: sha256(clean.png), width: clean.width, height: clean.height });
  return NextResponse.json({ ref, width: clean.width, height: clean.height });
}
