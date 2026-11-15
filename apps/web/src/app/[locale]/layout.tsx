import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { dirOf, INTL_TAG, type AppLocale } from "@/i18n/locales";
import { routing } from "@/i18n/routing";
import { fontVars } from "@/lib/fonts";

const PUBLIC_NS = ["common", "site", "public", "builder", "commerce", "account", "validation", "status"];

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = { themeColor: "#0B1424", width: "device-width", initialScale: 1 };

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    metadataBase: new URL(base),
    title: { default: t("meta.title"), template: `%s · ${t("brand")}` },
    description: t("meta.description"),
    alternates: { canonical: `/${locale}`, languages: Object.fromEntries(routing.locales.map((l) => [INTL_TAG[l as AppLocale], `/${l}`])) },
    openGraph: { type: "website", siteName: t("brand"), locale: INTL_TAG[locale as AppLocale]?.replace("-", "_"), title: t("meta.title"), description: t("meta.description") },
    robots: { index: true, follow: true },
  };
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const all = await getMessages();
  // Ship only public namespaces to the browser; admin/operator layouts add their own.
  const messages = Object.fromEntries(Object.entries(all).filter(([k]) => PUBLIC_NS.includes(k)));
  return (
    <html lang={locale} dir={dirOf(locale)} className={fontVars} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
