import { getTranslations, setRequestLocale } from "next-intl/server";
import { CountryChips } from "@/components/graves/CountryChips";
import { GraveCard } from "@/components/graves/GraveCard";
import { SearchBox } from "@/components/home/SearchBox";
import { EmptyState, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/format";
import { listGraves, searchGraveIds } from "@/server/graves";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.directory" });
  return { title: t("metaTitle"), description: t("metaDescription"), alternates: { canonical: `/${locale}/graves` } };
}

export default async function GravesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; country?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("site.directory");
  const all = await listGraves(locale);
  let graves = all;
  if (sp.q?.trim()) {
    const hits = await searchGraveIds(sp.q);
    const order = new Map(hits.map((h, i) => [h.graveId, i]));
    graves = graves.filter((g) => order.has(g.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }
  if (sp.country) graves = graves.filter((g) => g.countryCode === sp.country);
  const countries = [...new Set(all.map((g) => g.countryCode).filter(Boolean))].map((c) => ({ value: c, label: countryName(c, locale) })).sort((a, b) => a.label.localeCompare(b.label, locale));

  return (
    <div className="pb-24">
      <section className="border-b border-[var(--line)] bg-parchment/60">
        <div className="mx-auto max-w-[88rem] px-[var(--gutter)] pb-10 pt-10 sm:pt-16">
          <h1 className="font-display max-w-3xl text-[clamp(2.2rem,5vw,3.8rem)] font-medium leading-[1.05] text-midnight-900">{t("title")}</h1>
          <div className="mt-7 max-w-2xl">
            <SearchBox initialQuery={sp.q} />
          </div>
          {countries.length > 1 && (
            <div className="mt-6">
              <CountryChips countries={countries} current={sp.country} q={sp.q} allLabel={t("allCountries")} />
            </div>
          )}
        </div>
      </section>
      <div className="mx-auto max-w-[88rem] px-[var(--gutter)]">
        {sp.q && (
          <p className="mt-8 text-sm text-charcoal-500">
            {t("resultsFor", { count: graves.length })} <bdi className="font-medium text-midnight-900">“{sp.q}”</bdi>
          </p>
        )}
        {graves.length === 0 ? (
          <div className="mt-12">
            <EmptyState
              title={all.length === 0 ? t("none.title") : t("empty.title")}
              body={all.length === 0 ? t("none.body") : t("empty.body")}
              action={
                <Link href={`/request-grave${sp.q ? `?name=${encodeURIComponent(sp.q)}` : ""}`} className={buttonClass("primary", "md")}>
                  {t("suggest")}
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-10 grid gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {graves.map((g, i) => (
              <GraveCard key={g.id} g={g} locale={locale} priority={i < 2} sizes="(min-width:1280px) 25vw, (min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" />
            ))}
          </div>
        )}
        {graves.length > 0 && (
          <p className="mt-16 text-center text-sm text-charcoal-500">
            {t("missing")}{" "}
            <Link href="/request-grave" className="font-medium text-midnight-900 underline underline-offset-4">
              {t("suggest")}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
