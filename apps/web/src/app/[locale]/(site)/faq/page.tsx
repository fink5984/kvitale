import { getTranslations, setRequestLocale } from "next-intl/server";
import { Ornament } from "@/components/ui";

const KEYS = ["what", "prayer", "proof", "privacy", "language", "handwriting", "shabbat", "uncertain", "refund", "account", "multi", "video"] as const;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "public.faq" });
  return { title: t("title") };
}

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("public.faq");
  return (
    <div className="mx-auto max-w-3xl px-[var(--gutter)] pb-28 pt-16 sm:pt-24">
      <p className="eyebrow text-gold-700">{t("eyebrow")}</p>
      <h1 className="font-display mt-4 text-[clamp(2.6rem,6vw,4.4rem)] leading-[1] text-midnight-900">{t("title")}</h1>
      <div className="mt-12 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {KEYS.map((k) => (
          <details key={k} className="group py-6 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-6">
              <h2 className="font-display text-2xl leading-snug text-midnight-900">{t(`items.${k}.q`)}</h2>
              <span className="mt-1.5 grid size-7 shrink-0 place-items-center rounded-full border border-stone-300 text-gold-600 transition-transform duration-300 group-open:rotate-45" aria-hidden>
                +
              </span>
            </summary>
            <p className="mt-4 max-w-2xl leading-relaxed text-charcoal-600">{t(`items.${k}.a`)}</p>
          </details>
        ))}
      </div>
      <Ornament className="mt-16" />
    </div>
  );
}
