import { ArrowLeft, ArrowRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LogoMark } from "@/components/brand/Logo";
import { GraveCard } from "@/components/graves/GraveCard";
import { HeroSlider, type HeroSlide } from "@/components/home/HeroSlider";
import { SearchBox } from "@/components/home/SearchBox";
import { RevealWords } from "@/components/motion/RevealWords";
import { buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { dirOf } from "@/i18n/locales";
import { listGraves } from "@/server/graves";

export const dynamic = "force-dynamic";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.home");
  const graves = await listGraves(locale);
  const sendableFirst = [...graves].sort((a, b) => Number(b.featured) - Number(a.featured) || Number(a.availability.kind === "not_purchasable") - Number(b.availability.kind === "not_purchasable"));
  const featured = sendableFirst.filter((g) => g.featured || g.availability.kind !== "not_purchasable").slice(0, 5);
  const slides: HeroSlide[] = sendableFirst
    .filter((g) => g.cover)
    .slice(0, 4)
    .map((g) => ({ slug: g.slug, image: g.cover!, mobile: g.mobileImage }));
  const Arrow = dirOf(locale) === "rtl" ? ArrowLeft : ArrowRight;
  const hasPhotos = slides.length > 0;

  return (
    <>
      {/* hero + selected tziyunim share ONE fixed, full-viewport photographic backdrop; the content scrolls over it */}
      <div className="relative isolate text-ivory-50">
        <div className="backdrop-clip" aria-hidden>
          <div className="backdrop-fixed">
            <HeroSlider slides={slides} />
            {!hasPhotos && <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_20%,rgb(194_143_46/0.28),transparent_70%),radial-gradient(50%_60%_at_10%_100%,rgb(46_78_134/0.55),transparent_70%)]" />}
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(5_15_36/0.74),rgb(5_15_36/0.46)_55%,rgb(5_15_36/0.42))]" />
            <div className="ambient-gold" />
          </div>
        </div>

        {/* ───────────── 1 · HERO ───────────── */}
        <section className="relative flex min-h-[min(92svh,50rem)] items-end sm:items-center" aria-labelledby="hero-title">
          <div className="mx-auto grid w-full max-w-[88rem] items-center gap-10 px-[var(--gutter)] pb-14 pt-32 sm:py-32 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="max-w-2xl">
              <h1 id="hero-title" className="font-display text-[clamp(2.2rem,5.4vw,4.4rem)] font-bold leading-[1.1] [text-wrap:balance]">
                <RevealWords mode="load" text={t("hero.line1")} />
                <span className="mt-1 block text-gold-300">
                  <RevealWords mode="load" text={t("hero.line2")} className="gold-text" />
                </span>
              </h1>
              <p className="rise-in mt-5 max-w-xl text-[1.08rem] leading-relaxed text-ivory-100/90 [--d:600] sm:text-lg">{t("hero.sub")}</p>
              <div className="rise-in mt-8 max-w-xl [--d:800]">
                <SearchBox tone="dark" />
                <p className="mt-3 text-sm text-ivory-100/75">
                  <Link href="/graves" className="underline underline-offset-4 hover:text-ivory-50">
                    {t("hero.browse")}
                  </Link>
                </p>
              </div>
            </div>
            {!hasPhotos && (
              <div className="hidden lg:block" aria-hidden>
                <LogoMark size="lg" className="h-[22rem] w-auto drop-shadow-[0_30px_60px_rgb(0_0_0/0.45)]" />
              </div>
            )}
          </div>
        </section>

        {/* ───────────── 2 · SELECTED TZIYUNIM ───────────── */}
        {featured.length > 0 && (
          <section className="relative bg-[linear-gradient(to_bottom,transparent,rgb(5_15_36/0.74)_9rem)]" aria-labelledby="featured-title">
            <div className="mx-auto max-w-[88rem] px-[var(--gutter)] py-20 sm:py-28">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 id="featured-title" className="font-display text-[clamp(2rem,4.6vw,3.4rem)] font-bold leading-[1.05]">
                  <RevealWords text={t("featured.title")} />
                </h2>
                <Link href="/graves" className="inline-flex items-center gap-2 text-[0.95rem] font-medium text-gold-200 underline-offset-4 hover:underline">
                  {t("featured.all")} <Arrow className="size-4" aria-hidden />
                </Link>
              </div>
              <div className="mt-12 grid grid-cols-2 gap-x-3.5 gap-y-10 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-5">
                {featured.map((g, i) => (
                  <GraveCard key={g.id} g={g} locale={locale} index={i} tone="dark" priority={i < 2} />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ───────────── 3 · HOW — three words ───────────── */}
      <section className="border-y border-[var(--line)] bg-parchment/70" aria-labelledby="how-title">
        <div className="mx-auto max-w-[88rem] px-[var(--gutter)] py-16 sm:py-20">
          <h2 id="how-title" className="sr-only">
            {t("how.title")}
          </h2>
          <ol className="grid gap-10 sm:grid-cols-3 sm:gap-6">
            {(["choose", "write", "send"] as const).map((k, i) => (
              <li key={k} className="flex items-start gap-5 sm:flex-col sm:items-center sm:text-center">
                <span className="font-display text-5xl font-medium leading-none text-gold-500 tabular sm:text-6xl" aria-hidden>
                  {i + 1}
                </span>
                <div>
                  <p className="font-display text-2xl text-midnight-900 sm:text-[1.7rem]">{t(`how.${k}.title`)}</p>
                  <p className="mt-1.5 max-w-[18rem] text-[0.98rem] text-charcoal-600 sm:mx-auto">{t(`how.${k}.body`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────── 4 · ONE CALL TO ACTION ───────────── */}
      <section className="bg-midnight-900 text-ivory-50" aria-labelledby="cta-title">
        <div className="mx-auto flex max-w-3xl flex-col items-center px-[var(--gutter)] py-20 text-center sm:py-28">
          <LogoMark size="lg" className="h-24 w-auto" />
          <h2 id="cta-title" className="font-display mt-8 text-[clamp(2rem,5vw,3.4rem)] font-medium leading-[1.08] [text-wrap:balance]">
            {t("cta.title")}
          </h2>
          <Link href="/graves" className={buttonClass("gold", "xl", "mt-9")}>
            {t("cta.button")}
          </Link>
        </div>
      </section>
    </>
  );
}
