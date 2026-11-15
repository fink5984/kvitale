import { ArrowLeft, ArrowRight, CalendarDays, Clock, MapPin, Navigation } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { DemandButton } from "@/components/graves/DemandButton";
import { PhotoFallback, TziyunPhoto } from "@/components/graves/Photo";
import { Badge, Notice, Ornament, buttonClass } from "@/components/ui";
import { Writer } from "@/components/write/Writer";
import { Link } from "@/i18n/navigation";
import { dirOf, INTL_TAG, type AppLocale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { countryName, formatDate, formatDateTime, hebrewDate } from "@/lib/format";
import { can, getSession } from "@/server/auth/session";
import { getFlags } from "@/server/flags";
import { getBuilderGrave, getGrave } from "@/server/graves";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const g = await getGrave(slug, locale);
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
  // Admin preview of unpublished records (permission-checked).
  const preview = (await searchParams).preview === "1" && can(await getSession(), "graves.read");
  const g = await getGrave(slug, locale, { includeUnpublished: preview });
  if (!g) notFound();
  const [t, tw, ts, flags, builderGrave] = await Promise.all([getTranslations("public.grave"), getTranslations("common.weekdays"), getTranslations("site.write"), getFlags(), getBuilderGrave(slug, locale)]);
  const purchasable = g.availability.kind !== "not_purchasable";
  const Back = dirOf(locale) === "rtl" ? ArrowRight : ArrowLeft;
  const fmtMin = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const localNow = formatDateTime(new Date(), locale, g.timezone, { weekday: "long", hour: "2-digit", minute: "2-digit" });
  const bg = g.writingImage ?? g.cover;
  const credit = g.media.find((m) => m.id === bg?.id) ?? g.media[0];
  const hasHours = g.schedules.length > 0;

  return (
    <article>
      {/* ───────── the tziyun, and the page to write on ───────── */}
      <section className="relative isolate overflow-hidden pb-28 lg:pb-20" aria-labelledby="grave-title">
        <div className="absolute inset-0 -z-20 bg-midnight-900">
          {bg ? <TziyunPhoto image={bg} mobile={g.mobileImage} sizes="100vw" priority /> : <PhotoFallback nameHe={g.nameHe} className="[&>span]:hidden" />}
        </div>
        {/* readable-but-present veil: dark where the name sits, cream where the form sits */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,rgb(5_15_36/0.72)_0,rgb(5_15_36/0.45)_9rem,rgb(250_244_231/0.82)_22rem,rgb(250_244_231/0.93)_100%)]" aria-hidden />

        <div className="mx-auto max-w-6xl px-[var(--gutter)]">
          <header className="pb-8 pt-8 text-ivory-50 sm:pt-12">
            <Link href="/graves" className="inline-flex items-center gap-1.5 text-sm text-ivory-100/80 hover:text-ivory-50">
              <Back className="size-4" aria-hidden /> {t("allGraves")}
            </Link>
            <p className="eyebrow mt-6 text-gold-200">{g.place ?? countryName(g.countryCode, locale)}</p>
            <h1 id="grave-title" className="font-display mt-2 text-[clamp(2.3rem,6vw,4.2rem)] font-medium leading-[1.04]">
              <bdi>{g.name}</bdi>
            </h1>
            {g.epithet && <p className="mt-2 max-w-2xl text-lg text-ivory-100/85">{g.epithet}</p>}
            {g.translationLocale !== locale && (
              <div className="mt-4">
                <Badge tone="info">{t("translationFallback")}</Badge>
              </div>
            )}
          </header>

          {g.availability.kind === "scheduled" && (
            <Notice tone="warning" className="mb-6">
              {t(`scheduled.${g.availability.reason}`, { when: g.availability.nextOpenAt ? formatDateTime(g.availability.nextOpenAt, locale, g.timezone) : "—" })}
            </Notice>
          )}

          {purchasable && builderGrave ? (
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-12">
              <Writer grave={builderGrave} flags={{ handwriting: !!flags.handwriting }} />
            </div>
          ) : (
            <div className="max-w-2xl rounded-2xl border border-[var(--line)] bg-ivory-50/95 p-6 shadow-lift backdrop-blur-md sm:p-8">
              <h2 className="font-display text-2xl text-midnight-900">{t(`unavailable.${(g.availability as { reason: string }).reason}.title`)}</h2>
              <p className="mt-2 text-charcoal-600">{t(`unavailable.${(g.availability as { reason: string }).reason}.body`)}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <DemandButton slug={g.slug} />
                <Link href="/graves" className={buttonClass("ghost", "md")}>
                  {t("allGraves")}
                </Link>
              </div>
            </div>
          )}
          {credit?.credit && (
            <p className="mt-6 text-xs text-charcoal-600">{t("photoCredit", { credit: credit.credit, license: credit.license ?? "" })}</p>
          )}
        </div>
      </section>

      {/* ───────── more about the tzaddik (secondary; also what search engines read) ───────── */}
      <section className="border-t border-[var(--line)] bg-ivory-100" aria-labelledby="more-title">
        <div className="mx-auto grid max-w-6xl gap-14 px-[var(--gutter)] py-16 sm:py-20 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-12">
            <div>
              <p className="eyebrow text-gold-700">{ts("more.eyebrow")}</p>
              <h2 id="more-title" className="font-display mt-2 text-3xl text-midnight-900 sm:text-4xl">
                <bdi>{g.name}</bdi>
              </h2>
              <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4 text-[0.95rem]">
                {g.place && (
                  <div className="flex gap-3">
                    <MapPin className="mt-0.5 size-5 shrink-0 text-gold-600" strokeWidth={1.4} aria-hidden />
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-charcoal-500">{t("location")}</dt>
                      <dd className="mt-0.5 text-midnight-900">{g.place}</dd>
                    </div>
                  </div>
                )}
                {g.hilula?.verified && (
                  <div className="flex gap-3">
                    <CalendarDays className="mt-0.5 size-5 shrink-0 text-gold-600" strokeWidth={1.4} aria-hidden />
                    <div>
                      <dt className="text-xs uppercase tracking-wider text-charcoal-500">{t("hilula")}</dt>
                      <dd className="mt-0.5 text-midnight-900">
                        {hebrewDate(g.hilula.date, locale)} · <span className="text-charcoal-600">{formatDate(g.hilula.date, locale)}</span>
                      </dd>
                    </div>
                  </div>
                )}
              </dl>
            </div>
            {g.bio && (
              <div>
                <p className="max-w-prose whitespace-pre-line text-[1.08rem] leading-[1.9] text-charcoal-700">{g.bio}</p>
                {g.bioSources && <p className="mt-4 text-sm text-charcoal-500">{g.bioSources}</p>}
              </div>
            )}
            {g.customs && (
              <div>
                <h3 className="font-display text-2xl text-midnight-900">{t("customs")}</h3>
                <p className="mt-3 max-w-prose leading-relaxed text-charcoal-700">{g.customs}</p>
              </div>
            )}
            {g.aliases.length > 0 && (
              <div>
                <h3 className="font-display text-xl text-midnight-900">{t("aliases")}</h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {g.aliases.map((a) => (
                    <li key={a} className="rounded-full border border-[var(--line)] bg-ivory-50 px-3 py-1 text-sm text-charcoal-600">
                      <bdi>{a}</bdi>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {g.faq.length > 0 && (
              <div>
                <h3 className="font-display text-2xl text-midnight-900">{t("faq")}</h3>
                {g.faq.map((f) => (
                  <details key={f.q} className="border-b border-[var(--line)] py-3">
                    <summary className="cursor-pointer font-medium">{f.q}</summary>
                    <p className="mt-2 text-sm text-charcoal-600">{f.a}</p>
                  </details>
                ))}
              </div>
            )}
          </div>

          <aside className="space-y-6 lg:self-start">
            {hasHours && (
              <section className="rounded-xl border border-[var(--line)] bg-ivory-50 p-6" aria-labelledby="hours">
                <h3 id="hours" className="flex items-center gap-2 font-display text-xl text-midnight-900">
                  <Clock className="size-5 text-gold-600" strokeWidth={1.4} aria-hidden /> {t("hours.title")}
                </h3>
                <p className="mt-2 text-sm text-charcoal-500">{t("hours.localNow", { time: localNow, tz: g.timezone })}</p>
                <table className="mt-4 w-full text-sm">
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
            )}
            {g.location.verified && g.location.lat !== null && (
              <a className={buttonClass("outline", "md", "w-full")} href={`https://www.google.com/maps/dir/?api=1&destination=${g.location.lat},${g.location.lng}`} target="_blank" rel="noopener noreferrer">
                <Navigation className="size-4" /> {t("map.navigate")}
              </a>
            )}
          </aside>
        </div>
        <Ornament className="pb-16 text-gold-500/60" />
      </section>
    </article>
  );
}
