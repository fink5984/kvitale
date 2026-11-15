import { eq, and } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { orders, payments } from "@kvittel/db";
import { DemoPayActions } from "@/components/commerce/DemoPayActions";
import { LogoMark } from "@/components/brand/Logo";
import { formatMoney } from "@/lib/format";
import { getDb } from "@/server/db";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";

/** DEMO hosted payment page. Collects no card data. Emits a signed webhook like a real provider. */
export default async function DemoPayPage({ params }: { params: Promise<{ locale: string; ref: string }> }) {
  const { locale, ref } = await params;
  setRequestLocale(locale);
  if (!env.demoMode) notFound();
  const db = await getDb();
  const [row] = await db.select({ p: payments, o: orders }).from(payments).innerJoin(orders, eq(orders.id, payments.orderId)).where(and(eq(payments.provider, "mock"), eq(payments.providerRef, ref))).limit(1);
  if (!row) notFound();
  const t = await getTranslations("commerce.demoPay");
  return (
    <div className="tex-stone min-h-[80vh] px-[var(--gutter)] py-16">
      <div className="mx-auto max-w-lg overflow-hidden rounded-2xl border border-[var(--line)] bg-ivory-50 shadow-lift">
        <div className="flex items-center justify-between bg-ochre-100 px-6 py-3 text-ochre-600">
          <span className="font-mono text-xs font-semibold tracking-[0.18em]">DEMO PAYMENT PROVIDER</span>
          <span className="text-xs">{t("noCard")}</span>
        </div>
        <div className="p-8">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-8" />
            <div>
              <p className="text-sm text-charcoal-500">{t("merchant")}</p>
              <p className="font-mono text-sm">
                <bdi>{row.o.publicRef}</bdi>
              </p>
            </div>
          </div>
          <p className="mt-8 text-sm text-charcoal-500">{t("amount")}</p>
          <p className="font-display text-5xl text-midnight-900 tabular">{formatMoney(row.p.amountMinor, row.p.currency, locale)}</p>
          <p className="mt-6 text-sm leading-relaxed text-charcoal-600">{t("explain")}</p>
          <DemoPayActions providerRef={ref} orderRef={row.o.publicRef} status={row.p.status} />
        </div>
      </div>
    </div>
  );
}
