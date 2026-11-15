import { getTranslations, setRequestLocale } from "next-intl/server";
import { buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "site.how" });
  return { title: t("title"), description: t("intro") };
}

const STEPS = ["choose", "write", "pay", "follow"] as const;

export default async function HowPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("site.how");
  return (
    <div className="pb-24">
      <section className="border-b border-[var(--line)] bg-parchment/60">
        <div className="mx-auto max-w-3xl px-[var(--gutter)] py-14 text-center sm:py-20">
          <h1 className="font-display text-[clamp(2.4rem,6vw,4.2rem)] font-medium leading-[1.05] text-midnight-900">{t("title")}</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-charcoal-600">{t("intro")}</p>
        </div>
      </section>
      <div className="mx-auto max-w-3xl px-[var(--gutter)] pt-14">
        <ol className="space-y-10">
          {STEPS.map((k, i) => (
            <li key={k} className="grid grid-cols-[3rem_1fr] gap-5">
              <span className="font-display text-4xl font-medium leading-none text-gold-500 tabular" aria-hidden>
                {i + 1}
              </span>
              <div className="border-t border-[var(--line)] pt-3">
                <h2 className="font-display text-2xl text-midnight-900 sm:text-3xl">{t(`steps.${k}.title`)}</h2>
                <p className="mt-2 text-[1.02rem] leading-relaxed text-charcoal-600">{t(`steps.${k}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-14 rounded-2xl border border-gold-400/40 bg-gold-100/40 p-7">
          <h2 className="font-display text-xl text-midnight-900">{t("honesty.title")}</h2>
          <p className="mt-2 leading-relaxed text-charcoal-700">{t("honesty.body")}</p>
        </div>
        <div className="mt-12 text-center">
          <Link href="/graves" className={buttonClass("primary", "xl")}>
            {t("cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
