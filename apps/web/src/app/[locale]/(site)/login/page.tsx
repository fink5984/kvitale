import { getTranslations, setRequestLocale } from "next-intl/server";
import { LogoMark } from "@/components/brand/Logo";
import { LoginForm } from "@/components/site/AuthForms";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  const t = await getTranslations("account.login");
  return (
    <div className="min-h-[80vh] bg-parchment/50 px-[var(--gutter)] py-12 sm:py-20">
      <div className="mx-auto max-w-md rounded-2xl border border-[var(--line)] bg-ivory-50 px-6 pb-10 pt-10 shadow-lift sm:px-10">
        <LogoMark size="lg" className="mx-auto h-24 w-auto" />
        <h1 className="font-display mt-6 text-center text-4xl text-midnight-900">{t("title")}</h1>
        <p className="mt-3 text-center text-charcoal-600">{t("subtitle")}</p>
        <div className="mt-10">
          <LoginForm next={next} />
        </div>
      </div>
    </div>
  );
}
