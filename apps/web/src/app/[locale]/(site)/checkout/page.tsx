import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckoutView } from "@/components/commerce/CheckoutView";
import { getSession } from "@/server/auth/session";
import { env } from "@/server/env";
import { builderGraves } from "@/server/graves";
import { getCurrency } from "@/server/prefs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "commerce.checkout" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CheckoutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const currency = await getCurrency(locale);
  const session = await getSession();
  return <CheckoutView graves={await builderGraves(locale, currency)} currency={currency} sessionEmail={session?.email ?? null} demo={env.demoMode} />;
}
