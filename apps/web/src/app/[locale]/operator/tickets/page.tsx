import { getTranslations, setRequestLocale } from "next-intl/server";
import { TicketsBoard } from "@/components/operator/TicketsBoard";
import { requirePermission } from "@/server/auth/session";
import { operatorTickets } from "@/server/operator-queries";

export const dynamic = "force-dynamic";

export default async function TicketsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await requirePermission("operator.access");
  const t = await getTranslations("operator.tickets");
  const data = await operatorTickets(s, locale);
  return (
    <>
      <div className="mb-8">
        <p className="eyebrow text-gold-700">{t("eyebrow")}</p>
        <h1 className="font-display mt-2 text-[2.1rem] leading-tight text-midnight-900 sm:text-[2.6rem]">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-charcoal-600">{t("subtitle")}</p>
      </div>
      <TicketsBoard {...data} />
    </>
  );
}
