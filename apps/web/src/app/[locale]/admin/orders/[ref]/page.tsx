import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Dl, PageHeader, Panel, STATUS_TONE } from "@/components/admin/kit";
import { ItemActions, OrderActions, RefundApprove } from "@/components/admin/OrderActions";
import { Badge, DemoBadge } from "@/components/ui";
import { formatDateTime, formatMoney } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { orderDetail } from "@/server/admin-orders";

export default async function AdminOrder({ params }: { params: Promise<{ locale: string; ref: string }> }) {
  const { locale, ref } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "orders.read", `/admin/orders/${ref}`);
  const d = await orderDetail(ref, locale);
  if (!d) notFound();
  const t = await getTranslations("admin.orders");
  const ts = await getTranslations("status.order");
  const ti = await getTranslations("status.item");
  const o = d.order;
  const m = (v: number) => formatMoney(v, o.currency, locale);
  const can = (p: string) => (s.permissions as Set<string>).has(p);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/orders", label: t("title") }, { label: o.publicRef }]}
        title={<span className="flex flex-wrap items-center gap-3"><bdi className="font-mono text-[0.8em]">{o.publicRef}</bdi><Badge tone={STATUS_TONE[o.status] ?? "neutral"}>{ts(o.status)}</Badge>{o.isDemo && <DemoBadge />}</span>}
        description={t("detailDesc")}
        actions={can("orders.manage") ? <OrderActions orderId={o.id} /> : undefined}
      />
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          {d.items.map((it) => (
            <Panel key={it.id} title={<span className="flex items-center gap-2"><bdi>{it.graveName}</bdi><Badge tone={it.status === "delivered" ? "success" : it.status === "uncertain" || it.status === "failed" ? "danger" : "neutral"}>{ti(it.status)}</Badge></span>} action={<span className="text-sm tabular">{m(it.totalMinor)}</span>}>
              <Dl
                items={[
                  [t("item.pages"), it.pages],
                  [t("item.scheduled"), it.scheduledFor ? formatDateTime(it.scheduledFor, locale, it.timezone) : "—"],
                  [t("item.delivered"), it.deliveredAt ? `${formatDateTime(it.deliveredAt, locale, it.timezone)} (${it.timezone})` : "—"],
                  [t("item.confidence"), it.deliveryConfidence ? t(`confidence.${it.deliveryConfidence}`) : "—"],
                  [t("item.job"), it.job ? <span key="j" className="font-mono text-xs">{it.job.status} · {t("item.attempts", { n: it.job.attempts })} · {it.job.rasterDigest ?? "—"}</span> : "—"],
                  [t("item.lastError"), it.job?.lastError ?? "—"],
                ]}
              />
              {it.attempts.length > 0 && (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[34rem] text-xs">
                    <thead className="text-charcoal-500">
                      <tr>{["#", t("att.leased"), t("att.started"), t("att.printed"), t("att.cut"), t("att.chute"), t("att.outcome")].map((h) => <th key={h} className="pb-1 text-start font-medium">{h}</th>)}</tr>
                    </thead>
                    <tbody className="tabular">
                      {it.attempts.map((a) => (
                        <tr key={a.id} className="border-t border-[var(--line)]">
                          <td className="py-1.5">{a.attemptNo}</td>
                          {[a.leasedAt, a.startedAt, a.printedAt, a.cutAt, a.chuteAt].map((x, i) => <td key={i} className="py-1.5">{x ? formatDateTime(x, locale, it.timezone, { timeStyle: "medium" }) : "—"}</td>)}
                          <td className="py-1.5">{a.outcome ?? "…"}{a.error ? ` (${a.error})` : ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <ItemActions itemId={it.id} jobId={it.job?.id ?? null} jobStatus={it.job?.status ?? null} itemStatus={it.status} canManage={can("orders.manage")} canRefund={can("orders.refund.request")} canReveal={can("kvittel.content.read")} />
            </Panel>
          ))}
        </div>
        <div className="space-y-6">
          <Panel title={t("summary")}>
            <Dl
              items={[
                [t("cols.customer"), <bdi key="e" dir="ltr">{o.email}</bdi>],
                [t("locale"), o.locale],
                [t("cols.created"), formatDateTime(o.createdAt, locale)],
                [t("paid"), o.paidAt ? formatDateTime(o.paidAt, locale) : "—"],
                [t("subtotal"), m(o.subtotalMinor)],
                [t("discount"), o.discountMinor ? `−${m(o.discountMinor)}` : "—"],
                [t("cols.total"), <strong key="t">{m(o.totalMinor)}</strong>],
                [t("marketing"), o.marketingConsent ? "✓" : "—"],
              ]}
            />
          </Panel>
          <Panel title={t("payments")}>
            {d.payments.map((p) => (
              <div key={p.id} className="text-sm">
                <p className="flex justify-between"><span>{p.provider}{p.isDemo && <DemoBadge className="ms-2" />}</span><span className="tabular">{formatMoney(p.amountMinor, p.currency, locale)}</span></p>
                <p className="mt-1 font-mono text-xs text-charcoal-500">{p.providerRef} · {p.status}{p.refundedMinor ? ` · −${formatMoney(p.refundedMinor, p.currency, locale)}` : ""}</p>
              </div>
            ))}
            {d.paymentEvents.length > 0 && (
              <ul className="mt-4 space-y-1 border-t border-[var(--line)] pt-3 text-xs text-charcoal-600">
                {d.paymentEvents.map((e) => <li key={e.id} className="font-mono">{formatDateTime(e.receivedAt, locale, undefined, { timeStyle: "medium" })} · {e.type} · {e.outcome}</li>)}
              </ul>
            )}
          </Panel>
          {d.refunds.length > 0 && (
            <Panel title={t("refunds")}>
              <ul className="space-y-3 text-sm">
                {d.refunds.map((r) => (
                  <li key={r.id} className="flex items-start justify-between gap-3">
                    <span><span className="tabular">{formatMoney(r.amountMinor, r.currency, locale)}</span> · {r.status}<span className="block text-xs text-charcoal-500">{r.reason}</span></span>
                    {r.status === "requested" && can("orders.refund.approve") && <RefundApprove refundId={r.id} />}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title={t("audit")}>
            <ul className="space-y-2 text-xs">
              {d.audit.length === 0 && <li className="text-charcoal-500">—</li>}
              {d.audit.map((a) => <li key={a.id}><span className="font-mono">{a.action}</span> · {formatDateTime(a.createdAt, locale)}{a.reason && <span className="block text-charcoal-500">“{a.reason}”</span>}</li>)}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
