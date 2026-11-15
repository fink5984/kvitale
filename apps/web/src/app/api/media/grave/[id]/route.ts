import { eq } from "drizzle-orm";
import { graveMedia, graves } from "@kvittel/db";
import { can, getSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { storage } from "@/server/storage";

/**
 * Grave photo delivery.
 * Public: only rights-verified photos of published graves. Cached for a day (not "immutable"),
 * so withdrawing rights takes effect within 24h even in browser caches.
 * Admin (graves.read): any photo, including unverified ones, never cached publicly.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response(null, { status: 404 });
  const db = await getDb();
  const [m] = await db
    .select({ storageKey: graveMedia.storageKey, mime: graveMedia.mime, rightsVerified: graveMedia.rightsVerified, publishedAt: graves.publishedAt })
    .from(graveMedia)
    .innerJoin(graves, eq(graves.id, graveMedia.graveId))
    .where(eq(graveMedia.id, id));
  if (!m) return new Response(null, { status: 404 });
  const isPublic = m.rightsVerified && !!m.publishedAt;
  if (!isPublic && !can(await getSession(), "graves.read")) return new Response(null, { status: 404 });
  const data = await storage.get(m.storageKey);
  if (!data) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(data), {
    headers: {
      "content-type": m.mime,
      "cache-control": isPublic ? "public, max-age=86400" : "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
