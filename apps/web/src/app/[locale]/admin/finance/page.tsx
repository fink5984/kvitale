import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { graves, orderItems, orders, partnerAgreements, partners, payments, refunds } from "@kvittel/db";
import { Kpi, PageHeader, Panel, Table, Td } from "@/components/admin/kit";
import { Notice, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { getDb } from "@/server/db";

export default async function FinancePage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await guardPage(locale, "finance.read", "/admin/finance");
  const sd = Number((await searchParams).days);
  const days = [30, 90, 365].includes(sd) ? sd : 30;
  const t = await getTranslations("admin.finance");
  const tc = await getTranslations("admin.common");
  const db = await getDb();
  const from = new Date(Date.now() - days * 86400000);
  const ok = inArray(payments.status, ["succeeded", "refunded", "partially_refunded"]);
  const byCur = await db
    .select({
      currency: payments.currency,
      gross: sql<number>`sum(${payments.amountMinor})`,
      fees: sql<number>`sum(coalesce(${payments.feeMinor},0))`,
      refunded: sql<number>`sum(${payments.refundedMinor})`,
      n: sql<number>`count(*)`,
      demo: sql<number>`sum(case when ${payments.isDemo} then 1 else 0 end)`,
    })
    .from(payments)
    .where(and(ok, gte(payments.createdAt, from)))
    .groupBy(payments.currency);
  const byGrave = await db
    .select({ slug: graves.slug, currency: orders.currency, total: sql<number>`sum(${orderItems.totalMinor})`, n: sql<number>`count(*)` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(graves, eq(graves.id, orderItems.graveId))
    .where(and(gte(orders.createdAt, from), inArray(orders.status, ["paid", "in_fulfillment", "fulfilled", "attention", "partially_refunded"]), sql`${orderItems.status} <> 'refunded'`))
    .groupBy(graves.slug, orders.currency);
  const pending = await db.select({ n: sql<number>`count(*)` }).from(refunds).where(eq(refunds.status, "requested"));
  const unpaid = await db.select({ n: sql<number>`count(*)` }).from(orders).where(and(eq(orders.status, "pending_payment"), lt(orders.createdAt, new Date(Date.now() - 3600000))));
  const agreements = await db.select({ a: partnerAgreements, p: partners }).from(partnerAgreements).innerJoin(partners, eq(partners.id, partnerAgreements.partnerId));
  const anyDemo = byCur.some((r) => Number(r.demo) > 0);

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <>
            {[30, 90, 365].map((d) => (
              <Link key={d} href={`/admin/finance?days=${d}`} className={buttonClass(d === days ? "primary" : "outline", "sm")}>
                {t("days", { n: d })}
              </Link>
            ))}
            <a href={`/api/admin/export/finance?from=${from.toISOString().slice(0, 10)}`} className={buttonClass("outline", "sm")}>
              {tc("export")}
            </a>
          </>
        }
      />
      {anyDemo && <Notice tone="warning" className="mb-6">{tc("demoData")}</Notice>}
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label={t("pendingRefunds")} value={Number(pending[0]?.n ?? 0)} href="/admin/orders?status=attention" tone={Number(pending[0]?.n) ? "warning" : "default"} />
        <Kpi label={t("unpaid")} value={Number(unpaid[0]?.n ?? 0)} sub={t("unpaidSub")} href="/admin/orders?status=pending_payment" />
        <Kpi label={t("currencies")} value={byCur.length} sub={t("currenciesSub")} />
      </div>
      <Panel title={t("byCurrency")} className="mt-6" padded={false}>
        <Table head={[t("cols.currency"), t("cols.payments"), t("cols.gross"), t("cols.fees"), t("cols.refunds"), t("cols.net")]}>
          {byCur.map((r) => {
            const net = Number(r.gross) - Number(r.fees) - Number(r.refunded);
            return (
              <tr key={r.currency}>
                <Td className="font-medium">{r.currency}</Td>
                <Td className="tabular">{Number(r.n)}</Td>
                <Td className="tabular">{formatMoney(Number(r.gross), r.currency, locale)}</Td>
                <Td className="tabular text-charcoal-600"><bdi dir="ltr">−{formatMoney(Number(r.fees), r.currency, locale)}</bdi></Td>
                <Td className="tabular text-oxblood-600">{Number(r.refunded) ? <bdi dir="ltr">−{formatMoney(Number(r.refunded), r.currency, locale)}</bdi> : "—"}</Td>
                <Td className="tabular font-semibold">{formatMoney(net, r.currency, locale)}</Td>
              </tr>
            );
          })}
        </Table>
        <p className="px-5 py-3 text-xs text-charcoal-500">{t("feesNote")}</p>
      </Panel>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={t("byGrave")} padded={false}>
          <Table head={[t("cols.grave"), t("cols.currency"), t("cols.deliveries"), t("cols.revenue")]}>
            {byGrave
              .sort((a, b) => Number(b.total) - Number(a.total))
              .map((r) => (
                <tr key={r.slug + r.currency}>
                  <Td>{r.slug}</Td>
                  <Td>{r.currency}</Td>
                  <Td className="tabular">{Number(r.n)}</Td>
                  <Td className="tabular">{formatMoney(Number(r.total), r.currency, locale)}</Td>
                </tr>
              ))}
          </Table>
        </Panel>
        <Panel title={t("partners")}>
          <ul className="space-y-3 text-sm">
            {agreements.map(({ a, p }) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span>{p.name}</span>
                <span className="tabular text-charcoal-600">
                  {a.revenueShareBps / 100}% · {a.currency}
                </span>
              </li>
            ))}
          </ul>
          <Notice tone="info" className="mt-4">{t("settlementsFuture")}</Notice>
        </Panel>
      </div>
      <Notice tone="gold" className="mt-6">{t("invoicesNote")}</Notice>
    </>
  );
}
