import { CalendarDays, Clock, Info, MapPin, Navigation, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AvailabilityBadge, GravePortrait } from "@/components/graves/GraveCard";
import { DemandButton } from "@/components/graves/DemandButton";
import { Badge, DemoBadge, Notice, Ornament, buttonClass } from "@/components/ui";
import { INTL_TAG, type AppLocale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { countryName, formatDate, formatDateTime, formatMoney, hebrewDate } from "@/lib/format";
import { getGrave } from "@/server/graves";
import { getCurrency } from "@/server/prefs";
import { can, getSession } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const g = await getGrave(slug, locale, "USD");
  if (!g) return {};
  return {
    title: g.metaTitle ?? g.name,
    description: g.metaDescription ?? undefined,
    alternates: { canonical: `/${locale}/graves/${slug}`, languages: Object.fromEntries(routing.locales.map((l) => [INTL_TAG[l as AppLocale], `/${l}/graves/${slug}`])) },
    openGraph: { title: g.name, description: g.metaDescription ?? undefined, images: g.cover ? [{ url: `/api/media/grave/${g.cover.id}`, width: g.cover.width ?? undefined, height: g.cover.height ?? undefined }] : undefined },
  };
}

export default async function GravePage({ params, searchParams }: { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const currency = await getCurrency(locale);
  // Admin preview of unpublished records (permission-checked).
  const preview = (await searchParams).preview === "1" && can(await getSession(), "graves.read");
  const g = await getGrave(slug, locale, currency, { includeUnpublished: preview });
  if (!g) notFound();
  const t = await getTranslations("public.grave");
  const tw = await getTranslations("common.weekdays");
  const purchasable = g.availability.kind !== "not_purchasable";
  const fallback = g.translationLocale !== locale;
  const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const localNow = formatDateTime(new Date(), locale, g.timezone, { weekday: "long", hour: "2-digit", minute: "2-digit" });

  return (
    <article className="pb-28">
      {/* header */}
      <section className="tex-stone relative overflow-hidden border-b border-stone-300/60">
        <div className="mx-auto grid max-w-[88rem] gap-12 px-[var(--gutter)] py-14 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <figure className="mx-auto w-full max-w-sm">
            <GravePortrait nameHe={g.nameHe} photo={g.cover} eager size="lg" className="aspect-[4/5] w-full rounded-t-[999px] rounded-b-lg shadow-lift ring-1 ring-stone-300" />
            {g.cover && g.media[0]?.credit && (
              <figcaption className="mt-3 text-center text-xs text-charcoal-500">
                {t("photoCredit", { credit: g.media[0].credit, license: g.media[0].license ?? "" })}
              </figcaption>
            )}
          </figure>
          <div>
            <nav aria-label={t("breadcrumb")} className="text-sm text-charcoal-500">
              <Link href="/graves" className="hover:text-midnight-900">
                {t("allGraves")}
              </Link>
              <span className="mx-2" aria-hidden>
                /
              </span>
              <span>{countryName(g.countryCode, locale)}</span>
            </nav>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <AvailabilityBadge a={g.availability} />
              {g.isDemo && <DemoBadge />}
              {fallback && <Badge tone="info">{t("translationFallback")}</Badge>}
            </div>
            <h1 className="font-display mt-5 text-[clamp(2.5rem,5.6vw,4.8rem)] leading-[1] text-midnight-900">
              <bdi>{g.name}</bdi>
            </h1>
            {g.epithet && <p className="mt-4 text-xl text-charcoal-600">{g.epithet}</p>}
            <dl className="mt-8 grid gap-4 text-[0.95rem] sm:grid-cols-2">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 size-5 shrink-0 text-gold-600" strokeWidth={1.4} aria-hidden />
                <div>
                  <dt className="text-xs uppercase tracking-wider text-charcoal-500">{t("location")}</dt>
                  <dd className="mt-0.5 text-midnight-900">{g.place}</dd>
                </div>
              </div>
              {g.hilula && (
                <div className="flex gap-3">
                  <CalendarDays className="mt-0.5 size-5 shrink-0 text-gold-600" strokeWidth={1.4} aria-hidden />
                  <div>
                    <dt className="text-xs uppercase tracking-wider text-charcoal-500">{t("hilula")}</dt>
                    <dd className="mt-0.5 text-midnight-900">
                      {hebrewDate(g.hilula.date, locale)} · <span className="text-charcoal-600">{formatDate(g.hilula.date, locale)}</span>
                      {!g.hilula.verified && <span className="ms-1 text-xs text-ochre-600">({t("unverified")})</span>}
                    </dd>
                  </div>
                </div>
              )}
            </dl>

            <div className="mt-10 rounded-xl border border-[var(--line)] bg-ivory-50/80 p-5 shadow-soft backdrop-blur sm:p-6">
              {purchasable ? (
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-charcoal-500">{t("price")}</p>
                    <p className="font-display text-4xl text-midnight-900 tabular">{g.fromPrice ? formatMoney(g.fromPrice.amountMinor, g.fromPrice.currency, locale) : "—"}</p>
                    <p className="mt-1 text-xs text-charcoal-500">{t("priceNote")}</p>
                  </div>
                  <Link href={`/write?grave=${g.slug}`} className={buttonClass("primary", "xl")}>
                    {t("write")}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="max-w-md">
                    <p className="font-medium text-midnight-900">{t(`unavailable.${(g.availability as { reason: string }).reason}.title`)}</p>
                    <p className="mt-1 text-sm text-charcoal-600">{t(`unavailable.${(g.availability as { reason: string }).reason}.body`)}</p>
                  </div>
                  <DemandButton slug={g.slug} />
                </div>
              )}
              {g.availability.kind === "scheduled" && (
                <Notice tone="warning" className="mt-5">
                  {t(`scheduled.${g.availability.reason}`, { when: g.availability.nextOpenAt ? formatDateTime(g.availability.nextOpenAt, locale, g.timezone) : "—" })}
                </Notice>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-[88rem] gap-16 px-[var(--gutter)] pt-16 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-16">
          {g.bio && (
            <section aria-labelledby="about">
              <h2 id="about" className="font-display text-3xl text-midnight-900">
                {t("about")}
              </h2>
              <p className="mt-5 text-[1.08rem] leading-[1.85] text-charcoal-700 first-letter:font-display first-letter:text-5xl first-letter:leading-none first-letter:text-gold-600">{g.bio}</p>
              {g.bioSources && <p className="mt-4 flex items-start gap-2 text-sm text-charcoal-500"><Info className="mt-0.5 size-4 shrink-0" aria-hidden />{g.bioSources}</p>}
            </section>
          )}
          <section aria-labelledby="included">
            <h2 id="included" className="font-display text-3xl text-midnight-900">
              {t("included.title")}
            </h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {(["print", "cut", "sensor", "tracking"] as const).map((k) => (
                <li key={k} className="flex gap-3 rounded-lg border border-[var(--line)] bg-ivory-50 p-4">
                  <ShieldCheck className="mt-0.5 size-5 shrink-0 text-gold-600" strokeWidth={1.4} aria-hidden />
                  <span className="text-[0.95rem] text-charcoal-700">{t(`included.${k}`)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-charcoal-500">{t("included.notIncluded")}</p>
          </section>
          {g.customs && (
            <section aria-labelledby="customs">
              <h2 id="customs" className="font-display text-3xl text-midnight-900">
                {t("customs")}
              </h2>
              <p className="mt-5 leading-relaxed text-charcoal-700">{g.customs}</p>
            </section>
          )}
          {g.aliases.length > 0 && (
            <section aria-labelledby="aliases">
              <h2 id="aliases" className="font-display text-2xl text-midnight-900">
                {t("aliases")}
              </h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {g.aliases.map((a) => (
                  <li key={a} className="rounded-full border border-[var(--line)] bg-ivory-50 px-3 py-1 text-sm text-charcoal-600">
                    <bdi>{a}</bdi>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
          <section className="rounded-xl border border-[var(--line)] bg-ivory-50 p-6" aria-labelledby="hours">
            <h2 id="hours" className="flex items-center gap-2 font-display text-2xl text-midnight-900">
              <Clock className="size-5 text-gold-600" strokeWidth={1.4} aria-hidden /> {t("hours.title")}
            </h2>
            <p className="mt-2 text-sm text-charcoal-500">{t("hours.localNow", { time: localNow, tz: g.timezone })}</p>
            <table className="mt-5 w-full text-sm">
              <tbody>
                {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
                  const rows = g.schedules.filter((s) => s.weekday === wd);
                  return (
                    <tr key={wd} className="border-b border-[var(--line)] last:border-0">
                      <th scope="row" className="py-2 text-start font-normal text-charcoal-600">
                        {tw(String(wd))}
                      </th>
                      <td className="py-2 text-end tabular text-midnight-900">{rows.length ? rows.map((r) => `${fmtMin(r.openMinute)}–${fmtMin(r.closeMinute)}`).join(", ") : <span className="text-charcoal-500">{t("hours.closed")}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-4 text-xs leading-relaxed text-charcoal-500">{t("hours.policy")}</p>
          </section>
          <section className="overflow-hidden rounded-xl border border-[var(--line)] bg-ivory-50" aria-labelledby="map">
            <div className="tex-stone relative grid aspect-[4/3] place-items-center">
              <svg viewBox="0 0 200 150" className="absolute inset-0 h-full w-full text-stone-400/50" aria-hidden>
                {Array.from({ length: 9 }).map((_, i) => (
                  <path key={i} d={`M0 ${15 + i * 15} Q 50 ${5 + i * 15} 100 ${15 + i * 15} T 200 ${15 + i * 15}`} fill="none" stroke="currentColor" strokeWidth=".5" />
                ))}
              </svg>
              <div className="relative flex flex-col items-center text-center">
                <MapPin className="size-8 text-gold-600" strokeWidth={1.3} aria-hidden />
                <p className="mt-2 font-display text-xl text-midnight-900">{g.place}</p>
              </div>
            </div>
            <div className="p-5">
              <h2 id="map" className="sr-only">
                {t("map.title")}
              </h2>
              {g.location.verified && g.location.lat !== null ? (
                <a className={buttonClass("outline", "sm")} href={`https://www.google.com/maps/dir/?api=1&destination=${g.location.lat},${g.location.lng}`} target="_blank" rel="noopener noreferrer">
                  <Navigation className="size-4" /> {t("map.navigate")}
                </a>
              ) : (
                <p className="text-sm text-charcoal-500">{t("map.unverified")}</p>
              )}
            </div>
          </section>
          {g.faq.length > 0 && (
            <section aria-labelledby="gfaq">
              <h2 id="gfaq" className="font-display text-2xl text-midnight-900">
                {t("faq")}
              </h2>
              {g.faq.map((f) => (
                <details key={f.q} className="border-b border-[var(--line)] py-3">
                  <summary className="cursor-pointer font-medium">{f.q}</summary>
                  <p className="mt-2 text-sm text-charcoal-600">{f.a}</p>
                </details>
              ))}
            </section>
          )}
        </aside>
      </div>
      <Ornament className="mt-24" />
    </article>
  );
}
