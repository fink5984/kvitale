import { getTranslations, setRequestLocale } from "next-intl/server";
import { LogoMark } from "@/components/brand/Logo";
import { LoginForm } from "@/components/site/AuthForms";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const DEMO = [
  { email: "admin@demo.kvittel.local", role: "super_admin" },
  { email: "finance@demo.kvittel.local", role: "finance" },
  { email: "support@demo.kvittel.local", role: "support_limited" },
  { email: "content@demo.kvittel.local", role: "content_editor" },
  { email: "partner@demo.kvittel.local", role: "partner_manager" },
  { email: "maintainer@demo.kvittel.local", role: "local_maintainer" },
  { email: "customer@demo.kvittel.local", role: "customer" },
];

export default async function LoginPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  const t = await getTranslations("account.login");
  return (
    <div className="tex-stone min-h-[80vh] px-[var(--gutter)] py-16 sm:py-24">
      <div className="mx-auto max-w-md rounded-t-[12rem] rounded-b-2xl border border-[var(--line)] bg-ivory-50 px-6 pb-10 pt-20 shadow-lift sm:px-10">
        <LogoMark className="mx-auto h-14 w-12" />
        <h1 className="font-display mt-6 text-center text-4xl text-midnight-900">{t("title")}</h1>
        <p className="mt-3 text-center text-charcoal-600">{t("subtitle")}</p>
        <div className="mt-10">
          <LoginForm next={next} demoUsers={env.demoMode ? DEMO : null} />
        </div>
      </div>
    </div>
  );
}
