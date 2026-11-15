import type { MetadataRoute } from "next";
import { INTL_TAG, type AppLocale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { listGraves } from "@/server/graves";

export const dynamic = "force-dynamic";

/** Locale-aware sitemap with hreflang alternates for every public page. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const graves = await listGraves("en");
  const paths = ["", "/graves", "/how-it-works", "/faq", "/request-grave", "/legal/delivery-disclosure", "/legal/privacy", "/legal/refunds", "/legal/terms", ...graves.map((g) => `/graves/${g.slug}`)];
  return paths.flatMap((p) =>
    routing.locales.map((l) => ({
      url: `${base}/${l}${p}`,
      changeFrequency: p.startsWith("/graves/") ? ("weekly" as const) : ("monthly" as const),
      priority: p === "" ? 1 : p.startsWith("/graves") ? 0.8 : 0.5,
      alternates: { languages: Object.fromEntries(routing.locales.map((x) => [INTL_TAG[x as AppLocale], `${base}/${x}${p}`])) },
    })),
  );
}
