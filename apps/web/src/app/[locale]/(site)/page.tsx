import { ArrowUpRight, Eye, Lock, MapPinned, ScanLine } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { GraveCard, GravePortrait } from "@/components/graves/GraveCard";
import { HeroArt } from "@/components/home/HeroArt";
import { SearchBox } from "@/components/home/SearchBox";
import { ColumnIllustration } from "@/components/home/ColumnIllustration";
import { Ornament, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatDate, hebrewDate } from "@/lib/format";
import { listGraves } from "@/server/graves";
import { getCurrency } from "@/server/prefs";

export const dynamic = "force-dynamic";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("public.home");
  const currency = await getCurrency(locale);
  const graves = await listGraves(locale, currency);
  const featured = graves.filter((g) => g.featured).slice(0, 3);
  const upcoming = graves
    .filter((g) => g.hilula)
    .sort((a, b) => Date.parse(a.hilula!.date) - Date.parse(b.hilula!.date))
    .slice(0, 4);
  const activeCount = graves.filter((g) => g.availability.kind !== "not_purchasable").length;

  return (
    <>
      {/* ───────────── HERO ───────────── */}
      <section className="tex-night relative isolate overflow-hidden text-ivory-50">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_60%_at_75%_85%,rgb(179_141_72/0.22),transparent_70%),radial-gradient(50%_50%_at_10%_0%,rgb(43_67_105/0.55),transparent_70%)]" aria-hidden />
        <div className="mx-auto grid min-h-[min(100svh,64rem)] max-w-[88rem] items-center gap-10 px-[var(--gutter)] pb-20 pt-36 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-40">
          <div className="relative z-10 max-w-2xl">
            <p className="eyebrow reveal flex items-center gap-3 text-gold-300">
              <span className="h-px w-8 bg-gold-400/70" aria-hidden />
              {t("hero.eyebrow")}
            </p>
            <h1 className="font-display reveal reveal-1 mt-6 text-[clamp(2.9rem,7.4vw,6.2rem)] font-normal leading-[0.98] text-ivory-50">
              {t("hero.titleA")}
              <span className="italic-latin block text-gold-200">{t("hero.titleB")}</span>
            </h1>
            <p className="reveal reveal-2 mt-7 max-w-xl text-[1.08rem] leading-relaxed text-ivory-100/75 sm:text-lg">{t("hero.subtitle")}</p>
            <div className="reveal reveal-3 mt-10 max-w-xl">
              <SearchBox currency={currency} tone="dark" />
              <p className="mt-3 ps-6 text-[0.82rem] text-ivory-100/50">{t("hero.searchHint")}</p>
            </div>
            <ul className="reveal reveal-4 mt-12 grid max-w-xl grid-cols-2 gap-x-6 gap-y-4 text-[0.88rem] text-ivory-100/70 sm:grid-cols-4 sm:gap-x-4">
              {(["printed", "sensor", "noAccount", "private"] as const).map((k) => (
                <li key={k} className="flex items-start gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rotate-45 bg-gold-400" aria-hidden />
                  <span>{t(`hero.trust.${k}`)}</span>
                </li>
              ))}
            </ul>
          </div>
          <HeroArt className="pointer-events-none absolute inset-y-0 end-[-30%] w-[110%] opacity-25 sm:end-[-10%] sm:w-[70%] lg:relative lg:end-0 lg:mx-auto lg:h-[min(72vh,40rem)] lg:w-auto lg:opacity-100" />
        </div>
        <div className="hairline-gold opacity-40" />
      </section>

      {/* ───────────── FEATURED ───────────── */}
      <section className="mx-auto max-w-[88rem] px-[var(--gutter)] py-24 sm:py-32" aria-labelledby="featured-title">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="eyebrow text-gold-600">{t("featured.eyebrow")}</p>
            <h2 id="featured-title" className="font-display mt-4 text-[clamp(2.2rem,4.6vw,3.8rem)] leading-[1.02] text-midnight-900">
              {t("featured.title")}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-charcoal-600">{t("featured.body", { count: activeCount })}</p>
          </div>
          <Link href="/graves" className={buttonClass("outline", "lg")}>
            {t("featured.all")}
            <ArrowUpRight className="flip-rtl size-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-14 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((g, i) => (
            <GraveCard key={g.id} g={g} locale={locale} priority={i === 0} />
          ))}
        </div>
      </section>

      {/* ───────────── JOURNEY ───────────── */}
      <section className="tex-stone relative overflow-hidden border-y border-stone-300/60" aria-labelledby="journey-title">
        <div className="mx-auto max-w-[88rem] px-[var(--gutter)] py-24 sm:py-32">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow text-gold-700">{t("journey.eyebrow")}</p>
            <h2 id="journey-title" className="font-display mt-4 text-[clamp(2.2rem,4.6vw,3.8rem)] leading-[1.02] text-midnight-900">
              {t("journey.title")}
            </h2>
            <Ornament className="mt-8" />
          </div>
          <ol className="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
            <span className="absolute inset-x-[12%] top-10 hidden h-px bg-[repeating-linear-gradient(90deg,var(--color-gold-500)_0_6px,transparent_6px_14px)] opacity-60 md:block" aria-hidden />
            {(["choose", "write", "pay", "deliver"] as const).map((k, i) => (
              <li key={k} className="relative flex flex-col items-center text-center">
                <span className="relative grid size-20 place-items-center rounded-t-full rounded-b-lg bg-ivory-50 shadow-soft ring-1 ring-stone-300">
                  <StepGlyph step={k} />
                  <span className="absolute -bottom-3 rounded-full bg-midnight-900 px-2.5 py-0.5 text-[0.7rem] font-semibold text-gold-200 tabular">{String(i + 1).padStart(2, "0")}</span>
                </span>
                <h3 className="font-display mt-7 text-2xl text-midnight-900">{t(`journey.${k}.title`)}</h3>
                <p className="mt-2 max-w-[17rem] text-[0.95rem] leading-relaxed text-charcoal-600">{t(`journey.${k}.body`)}</p>
              </li>
            ))}
          </ol>
          <p className="mx-auto mt-14 max-w-xl text-center text-sm text-charcoal-500">{t("journey.note")}</p>
        </div>
      </section>

      {/* ───────────── DELIVERY PROOF ───────────── */}
      <section className="tex-night relative overflow-hidden text-ivory-50" aria-labelledby="proof-title">
        <div className="pointer-events-none absolute -end-40 top-0 h-[40rem] w-[40rem] rounded-full bg-gold-400/10 blur-3xl" aria-hidden />
        <div className="mx-auto grid max-w-[88rem] items-center gap-16 px-[var(--gutter)] py-24 sm:py-32 lg:grid-cols-2">
          <div className="order-2 min-w-0 lg:order-1">
            <ColumnIllustration className="mx-auto h-auto max-h-[36rem] w-full max-w-md" />
          </div>
          <div className="order-1 min-w-0 max-w-xl lg:order-2">
            <p className="eyebrow text-gold-300">{t("proof.eyebrow")}</p>
            <h2 id="proof-title" className="font-display mt-4 text-[clamp(2.2rem,4.6vw,3.8rem)] leading-[1.02]">
              {t("proof.title")}
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-ivory-100/70">{t("proof.body")}</p>
            <ol className="mt-10 space-y-0">
              {(["printed", "cut", "chute", "delivered"] as const).map((k, i, arr) => (
                <li key={k} className="relative flex gap-5 pb-7 last:pb-0">
                  {i < arr.length - 1 && <span className="absolute start-[0.6875rem] top-7 h-[calc(100%-1.5rem)] w-px bg-gold-400/30" aria-hidden />}
                  <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${k === "delivered" ? "bg-gold-400 text-midnight-950" : "bg-midnight-700 text-gold-200 ring-1 ring-gold-400/40"} text-[0.7rem] font-bold`}>{k === "delivered" ? "✓" : i + 1}</span>
                  <div>
                    <p className="font-medium text-ivory-50">{t(`proof.steps.${k}.title`)}</p>
                    <p className="mt-1 text-[0.92rem] leading-relaxed text-ivory-100/60">{t(`proof.steps.${k}.body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-8 rounded-md border border-ivory-50/10 bg-ivory-50/[0.04] px-4 py-3 text-[0.85rem] leading-relaxed text-ivory-100/60">{t("proof.honesty")}</p>
          </div>
        </div>
      </section>

      {/* ───────────── HILULOT ───────────── */}
      {upcoming.length > 0 && (
        <section className="mx-auto max-w-[88rem] px-[var(--gutter)] py-24 sm:py-32" aria-labelledby="hilulot-title">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow text-gold-600">{t("hilulot.eyebrow")}</p>
              <h2 id="hilulot-title" className="font-display mt-4 text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] text-midnight-900">
                {t("hilulot.title")}
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-charcoal-600">{t("hilulot.body")}</p>
            </div>
            <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
              {upcoming.map((g) => (
                <li key={g.id}>
                  <Link href={`/graves/${g.slug}`} className="group grid grid-cols-[4.5rem_1fr_auto] items-center gap-5 py-5 sm:grid-cols-[5.5rem_1fr_auto]">
                    <GravePortrait nameHe={g.nameHe} photo={g.cover} size="sm" className="aspect-[4/5] rounded-t-full rounded-b-sm ring-1 ring-stone-300 [&_.hebrew-name]:!text-[0.6rem]" />
                    <div className="min-w-0">
                      <p className="font-display truncate text-[1.45rem] leading-tight text-midnight-900 transition-colors group-hover:text-gold-700">
                        <bdi>{g.name}</bdi>
                      </p>
                      <p className="mt-1 truncate text-sm text-charcoal-500">{g.place}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-display text-lg text-midnight-900">{hebrewDate(g.hilula!.date, locale)}</p>
                      <p className="text-xs text-charcoal-500 tabular">{formatDate(g.hilula!.date, locale)}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-6 text-xs text-charcoal-500">{t("hilulot.verify")}</p>
        </section>
      )}

      {/* ───────────── PRINCIPLES ───────────── */}
      <section className="border-t border-[var(--line)] bg-ivory-50" aria-labelledby="principles-title">
        <div className="mx-auto max-w-[88rem] px-[var(--gutter)] py-24 sm:py-28">
          <h2 id="principles-title" className="font-display max-w-3xl text-[clamp(2rem,4vw,3.2rem)] leading-[1.05] text-midnight-900">
            {t("principles.title")}
          </h2>
          <div className="mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["privacy", Lock],
                ["honesty", Eye],
                ["permission", MapPinned],
                ["physical", ScanLine],
              ] as const
            ).map(([k, Icon]) => (
              <div key={k} className="border-t border-gold-400/60 pt-6">
                <Icon className="size-6 text-gold-600" strokeWidth={1.25} aria-hidden />
                <h3 className="font-display mt-5 text-2xl text-midnight-900">{t(`principles.${k}.title`)}</h3>
                <p className="mt-2 text-[0.95rem] leading-relaxed text-charcoal-600">{t(`principles.${k}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── FINAL CTA ───────────── */}
      <section className="tex-stone relative overflow-hidden" aria-labelledby="cta-title">
        <div className="mx-auto flex max-w-4xl flex-col items-center px-[var(--gutter)] py-24 text-center sm:py-32">
          <Ornament />
          <h2 id="cta-title" className="font-display mt-8 text-[clamp(2.4rem,5vw,4.2rem)] leading-[1.02] text-midnight-900">
            {t("cta.title")}
          </h2>
          <p className="mt-5 max-w-xl text-lg text-charcoal-600">{t("cta.body")}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/write" className={buttonClass("primary", "xl")}>
              {t("cta.write")}
            </Link>
            <Link href="/how-it-works" className={buttonClass("outline", "xl")}>
              {t("cta.learn")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

function StepGlyph({ step }: { step: "choose" | "write" | "pay" | "deliver" }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 32 32" className="size-8 text-gold-600" aria-hidden>
      {step === "choose" && (
        <g {...common}>
          <path d="M16 29s-9-8.3-9-15a9 9 0 0118 0c0 6.7-9 15-9 15z" />
          <path d="M12 15v-2.5a4 4 0 018 0V15" />
        </g>
      )}
      {step === "write" && (
        <g {...common}>
          <path d="M8 4h12l4 4v20H8z" />
          <path d="M12 12h8M12 16h8M12 20h5" />
          <path d="M23 18l4-4 1.5 1.5-4 4H23z" />
        </g>
      )}
      {step === "pay" && (
        <g {...common}>
          <path d="M16 3l11 5v7c0 7-5 12-11 14-6-2-11-7-11-14V8z" />
          <path d="M11 16l3.5 3.5L21 13" />
        </g>
      )}
      {step === "deliver" && (
        <g {...common}>
          <path d="M6 29V14C6 8 10.5 3.5 16 3c5.5.5 10 5 10 11v15" />
          <path d="M12 22h8" />
          <path d="M16 9v9M13 15l3 3 3-3" />
        </g>
      )}
    </svg>
  );
}
