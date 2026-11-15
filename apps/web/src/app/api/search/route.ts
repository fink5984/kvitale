import { NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { CURRENCIES } from "@/i18n/locales";
import { searchGraves } from "@/server/graves";
import { rateLimit } from "@/server/ratelimit";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 80);
  const locale = (routing.locales as readonly string[]).includes(url.searchParams.get("locale") ?? "") ? url.searchParams.get("locale")! : "he";
  const currency = (CURRENCIES as readonly string[]).includes(url.searchParams.get("currency") ?? "") ? url.searchParams.get("currency")! : "USD";
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`search:${ip}`, 120, 60_000).ok) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  const results = q.trim().length < 2 ? [] : (await searchGraves(q, locale, currency)).slice(0, 8);
  return NextResponse.json(
    { results: results.map((g) => ({ slug: g.slug, name: g.name, nameHe: g.nameHe, place: g.place, availability: g.availability, isDemo: g.isDemo })) },
    { headers: { "cache-control": "no-store" } },
  );
}
