import { getTranslations, setRequestLocale } from "next-intl/server";
import { Builder } from "@/components/builder/Builder";
import { getFlags } from "@/server/flags";
import { builderGraves } from "@/server/graves";
import { getCurrency } from "@/server/prefs";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "builder" });
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function WritePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ grave?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { grave } = await searchParams;
  const [graves, flags] = await Promise.all([builderGraves(locale, await getCurrency(locale)), getFlags()]);
  return <Builder graves={graves} initialSlug={graves.some((g) => g.slug === grave) ? grave : undefined} flags={{ handwriting: !!flags.handwriting_upload, multiGrave: !!flags.multi_grave_orders }} />;
}
