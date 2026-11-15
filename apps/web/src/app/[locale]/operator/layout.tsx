import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { OperatorShell } from "@/components/operator/OperatorShell";
import { getSession } from "@/server/auth/session";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operator", robots: { index: false, follow: false } };

export default async function OperatorLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await getSession();
  if (!s) redirect(`/${locale}/login?next=/operator`);
  if (!s.permissions.has("operator.access")) redirect(`/${locale}/account`);
  const t = await getTranslations("operator.shell");
  const all = await getMessages();
  const messages = Object.fromEntries(Object.entries(all).filter(([k]) => ["common", "status", "operator"].includes(k)));
  return (
    <NextIntlClientProvider messages={messages}>
      <OperatorShell who={s.displayName ?? s.email} scopeLabel={s.graveScope ? t("scoped", { count: s.graveScope.length }) : t("unscoped")} canAdmin={s.permissions.has("admin.access")} demo={env.demoMode}>
        {children}
      </OperatorShell>
    </NextIntlClientProvider>
  );
}
