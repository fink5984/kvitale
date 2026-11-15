import { getTranslations, setRequestLocale } from "next-intl/server";
import { CartView } from "@/components/commerce/CartView";
import { builderGraves } from "@/server/graves";
import { getCurrency } from "@/server/prefs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "commerce.cart" });
  return { title: t("title"), robots: { index: false } };
}

export default async function CartPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const currency = await getCurrency(locale);
  return <CartView graves={await builderGraves(locale, currency)} currency={currency} />;
}
