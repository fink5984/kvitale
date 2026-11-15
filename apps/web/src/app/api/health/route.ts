import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { dbHandle } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  try {
    const h = await dbHandle();
    await h.db.execute(sql`select 1`);
    return NextResponse.json({ ok: true, db: h.driver, latencyMs: Date.now() - started, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
