import { getTranslations, setRequestLocale } from "next-intl/server";
import { ColumnIllustration } from "@/components/home/ColumnIllustration";
import { Ornament, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "public.how" });
  return { title: t("title"), description: t("intro") };
}

const STEPS = ["choose", "write", "preview", "pay", "queue", "print", "chute", "notify"] as const;

export default async function HowPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("public.how");
  return (
    <div className="pb-28">
      <section className="tex-stone border-b border-stone-300/60">
        <div className="mx-auto max-w-4xl px-[var(--gutter)] py-16 text-center sm:py-24">
          <p className="eyebrow text-gold-700">{t("eyebrow")}</p>
          <h1 className="font-display mt-4 text-[clamp(2.6rem,6vw,4.8rem)] leading-[1] text-midnight-900">{t("title")}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-charcoal-600">{t("intro")}</p>
          <Ornament className="mt-10" />
        </div>
      </section>
      <div className="mx-auto grid max-w-6xl gap-16 px-[var(--gutter)] pt-16 lg:grid-cols-[1fr_22rem]">
        <ol className="space-y-12">
          {STEPS.map((k, i) => (
            <li key={k} className="grid grid-cols-[3.5rem_1fr] gap-5">
              <span className="font-display text-4xl leading-none text-gold-500 tabular">{String(i + 1).padStart(2, "0")}</span>
              <div className="border-t border-[var(--line)] pt-4">
                <h2 className="font-display text-3xl text-midnight-900">{t(`steps.${k}.title`)}</h2>
                <p className="mt-3 text-[1.02rem] leading-relaxed text-charcoal-600">{t(`steps.${k}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
        <aside className="tex-night rounded-t-[12rem] rounded-b-xl p-6 lg:sticky lg:top-28 lg:self-start">
          <ColumnIllustration className="mx-auto h-auto max-h-[26rem] w-full" />
        </aside>
      </div>
      <div className="mx-auto mt-20 max-w-3xl px-[var(--gutter)]">
        <div className="rounded-xl border border-gold-400/40 bg-gold-100/40 p-8">
          <h2 className="font-display text-2xl text-midnight-900">{t("honesty.title")}</h2>
          <p className="mt-3 leading-relaxed text-charcoal-700">{t("honesty.body")}</p>
        </div>
        <div className="mt-12 text-center">
          <Link href="/write" className={buttonClass("primary", "xl")}>
            {t("cta")}
          </Link>
        </div>
      </div>
    </div>
  );
}
