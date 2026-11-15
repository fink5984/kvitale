import { getTranslations, setRequestLocale } from "next-intl/server";
import { GraveCard } from "@/components/graves/GraveCard";
import { FilterBar } from "@/components/graves/FilterBar";
import { SearchBox } from "@/components/home/SearchBox";
import { EmptyState, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/format";
import { listGraves, searchGraveIds } from "@/server/graves";
import { getCurrency } from "@/server/prefs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "public.directory" });
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: { canonical: `/${locale}/graves` } };
}

type SP = { q?: string; country?: string; status?: string; dynasty?: string; sort?: string };

export default async function GravesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("public.directory");
  const currency = await getCurrency(locale);
  let graves = await listGraves(locale, currency);
  const all = graves;
  if (sp.q?.trim()) {
    const hits = await searchGraveIds(sp.q);
    const order = new Map(hits.map((h, i) => [h.graveId, i]));
    graves = graves.filter((g) => order.has(g.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }
  if (sp.country) graves = graves.filter((g) => g.countryCode === sp.country);
  if (sp.dynasty) graves = graves.filter((g) => g.dynasty === sp.dynasty);
  if (sp.status === "available") graves = graves.filter((g) => g.availability.kind === "available_now");
  else if (sp.status === "purchasable") graves = graves.filter((g) => g.availability.kind !== "not_purchasable");
  else if (sp.status === "soon") graves = graves.filter((g) => g.status === "coming_soon");
  if (sp.sort === "hilula") graves = [...graves].sort((a, b) => (a.hilula ? Date.parse(a.hilula.date) : Infinity) - (b.hilula ? Date.parse(b.hilula.date) : Infinity));
  else if (sp.sort === "name") graves = [...graves].sort((a, b) => a.name.localeCompare(b.name, locale));

  const countries = [...new Set(all.map((g) => g.countryCode))].map((c) => ({ value: c, label: countryName(c, locale) })).sort((a, b) => a.label.localeCompare(b.label, locale));
  const dynasties = [...new Set(all.map((g) => g.dynasty).filter(Boolean))] as string[];

  return (
    <div className="pb-28">
      <section className="tex-stone border-b border-stone-300/60">
        <div className="mx-auto max-w-[88rem] px-[var(--gutter)] pb-14 pt-14 sm:pt-20">
          <p className="eyebrow text-gold-700">{t("eyebrow")}</p>
          <h1 className="font-display mt-4 max-w-3xl text-[clamp(2.4rem,5.4vw,4.4rem)] leading-[1.02] text-midnight-900">{t("title")}</h1>
          <p className="mt-4 max-w-2xl text-lg text-charcoal-600">{t("subtitle")}</p>
          <div className="mt-10 max-w-2xl">
            <SearchBox currency={currency} />
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[88rem] px-[var(--gutter)]">
        <FilterBar countries={countries} dynasties={dynasties} current={sp} total={graves.length} />
        {sp.q && (
          <p className="mt-6 text-sm text-charcoal-500">
            {t("resultsFor", { count: graves.length })} <bdi className="font-medium text-midnight-900">“{sp.q}”</bdi>
          </p>
        )}
        {graves.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              title={t("empty.title")}
              body={t("empty.body")}
              action={
                <Link href={`/request-grave${sp.q ? `?name=${encodeURIComponent(sp.q)}` : ""}`} className={buttonClass("primary", "md")}>
                  {t("empty.cta")}
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-12 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {graves.map((g) => (
              <GraveCard key={g.id} g={g} locale={locale} />
            ))}
          </div>
        )}
        <div className="mt-24 flex flex-col items-center gap-4 rounded-xl border border-[var(--line)] bg-ivory-50 px-6 py-12 text-center">
          <h2 className="font-display text-3xl text-midnight-900">{t("missing.title")}</h2>
          <p className="max-w-lg text-charcoal-600">{t("missing.body")}</p>
          <Link href="/request-grave" className={buttonClass("outline", "md")}>
            {t("missing.cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
