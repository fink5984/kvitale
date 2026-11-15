import { and, eq } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { pages, pageTranslations } from "@kvittel/db";
import { Badge } from "@/components/ui";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";

/** Minimal, safe markdown: paragraphs, **bold**, "- " lists. Content is escaped by React. */
function Md({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : p));
  return (
    <>
      {blocks.map((b, i) =>
        b.split("\n").every((l) => l.startsWith("- ")) ? (
          <ul key={i} className="my-5 list-disc space-y-2 ps-6">
            {b.split("\n").map((l, j) => (
              <li key={j}>{inline(l.slice(2))}</li>
            ))}
          </ul>
        ) : (
          <p key={i} className="my-5">
            {inline(b)}
          </p>
        ),
      )}
    </>
  );
}

async function load(slug: string, locale: string) {
  const db = await getDb();
  const [p] = await db.select().from(pages).where(and(eq(pages.slug, slug), eq(pages.published, true)));
  if (!p) return null;
  const tr = await db.select().from(pageTranslations).where(eq(pageTranslations.pageId, p.id));
  const exact = tr.find((x) => x.locale === locale);
  return { tr: exact ?? tr.find((x) => x.locale === "en") ?? tr[0], fallback: !exact };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  const r = await load(slug, locale);
  return r?.tr ? { title: r.tr.title } : {};
}

export default async function LegalPage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const r = await load(slug, locale);
  if (!r?.tr) notFound();
  const t = await getTranslations("public.legal");
  return (
    <article className="mx-auto max-w-3xl px-[var(--gutter)] pb-28 pt-16 sm:pt-24">
      {r.fallback && <Badge tone="info">{t("fallback")}</Badge>}
      <h1 className="font-display mt-4 text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] text-midnight-900" lang={r.tr.locale}>
        {r.tr.title}
      </h1>
      <div className="mt-8 text-[1.05rem] leading-[1.85] text-charcoal-700" lang={r.tr.locale}>
        <Md text={r.tr.body} />
      </div>
      {!r.tr.reviewed && <p className="mt-10 text-sm text-ochre-600">{t("draft")}</p>}
    </article>
  );
}
