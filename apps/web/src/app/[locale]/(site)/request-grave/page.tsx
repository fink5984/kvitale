import { getTranslations, setRequestLocale } from "next-intl/server";
import { RequestGraveForm } from "@/components/site/AuthForms";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "public.requestGrave" });
  return { title: t("title") };
}

export default async function RequestGravePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ name?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { name } = await searchParams;
  const t = await getTranslations("public.requestGrave");
  return (
    <div className="mx-auto max-w-2xl px-[var(--gutter)] pb-28 pt-16 sm:pt-24">
      <p className="eyebrow text-gold-700">{t("eyebrow")}</p>
      <h1 className="font-display mt-4 text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] text-midnight-900">{t("title")}</h1>
      <p className="mt-4 text-lg text-charcoal-600">{t("body")}</p>
      <div className="mt-10 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-soft sm:p-8">
        <RequestGraveForm initialName={name?.slice(0, 160)} />
      </div>
    </div>
  );
}
