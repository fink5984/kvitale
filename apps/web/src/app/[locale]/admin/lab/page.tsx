import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/kit";
import { DeviceLab } from "@/components/lab/DeviceLab";
import { guardPage } from "@/server/admin-guard";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

export default async function LabPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!env.demoMode) notFound();
  await guardPage(locale, "lab.use", "/admin/lab");
  const t = await getTranslations("lab");
  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <DeviceLab />
    </>
  );
}
