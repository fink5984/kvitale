import { getTranslations, setRequestLocale } from "next-intl/server";
import { BarChart, Kpi, PageHeader, Panel, pctDelta } from "@/components/admin/kit";
import { Notice } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { LOCALE_NATIVE, type AppLocale } from "@/i18n/locales";
import { cn, countryName, formatMoney, formatNumber } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { overview } from "@/server/analytics";

export default async function AdminOverview({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ days?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await guardPage(locale, "overview.read", "/admin");
  const sp = await searchParams;
  const days = [7, 30, 90].includes(Number(sp.days)) ? Number(sp.days) : 30;
  const t = await getTranslations("admin.overview");
  const tc = await getTranslations("admin.common");
  const o = await overview(days);
  const top = o.cur.revenue[0];
  const prevTop = o.prev.revenue.find((r) => r.currency === top?.currency);
  const maxLocale = Math.max(1, ...o.byLocale.map((r) => r.n));
  const maxGrave = Math.max(1, ...o.byGrave.map((r) => r.n));

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("title")}
        description={t("description")}
        actions={
          <div className="inline-flex rounded-full border border-[var(--line-strong)] bg-ivory-50 p-1" role="group" aria-label={t("period")}>
            {[7, 30, 90].map((d) => (
              <Link key={d} href={`/admin?days=${d}`} aria-current={d === days ? "true" : undefined} className={cn("rounded-full px-3.5 py-1.5 text-sm", d === days ? "bg-midnight-900 text-ivory-50" : "text-charcoal-600 hover:text-midnight-900")}>
                {t("days", { n: d })}
              </Link>
            ))}
          </div>
        }
      />
      {o.cur.demoOrders > 0 && <Notice tone="warning" className="mb-6">{tc("demoData")}</Notice>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={t("kpi.revenue", { currency: top?.currency ?? "—" })} value={top ? formatMoney(top.net, top.currency, locale) : "—"} sub={t("kpi.revenueSub")} delta={{ pct: top && prevTop ? pctDelta(top.net, prevTop.net) : null }} href="/admin/finance" demo={o.cur.demoOrders > 0} />
        <Kpi label={t("kpi.orders")} value={formatNumber(o.cur.orders, locale)} sub={t("kpi.deliveries", { n: o.cur.deliveries })} delta={{ pct: pctDelta(o.cur.orders, o.prev.orders) }} href="/admin/orders" />
        <Kpi label={t("kpi.delivered")} value={formatNumber(o.cur.delivered, locale)} sub={t("kpi.deliveredSub")} delta={{ pct: pctDelta(o.cur.delivered, o.prev.delivered) }} href="/admin/orders?status=delivered" />
        <Kpi label={t("kpi.failure")} value={`${o.cur.failureRate.toFixed(1)}%`} sub={t("kpi.failureSub")} delta={{ pct: pctDelta(o.cur.failureRate, o.prev.failureRate), good: "down" }} tone={o.cur.failureRate > 5 ? "warning" : "default"} href="/admin/orders?status=attention" />
        <Kpi label={t("kpi.queued")} value={formatNumber(o.queued, locale)} sub={o.uncertain ? t("kpi.uncertain", { n: o.uncertain }) : t("kpi.queuedSub")} tone={o.uncertain ? "danger" : "default"} href="/admin/orders?status=attention" />
        <Kpi label={t("kpi.fleet")} value={`${o.devices.online}/${o.devices.total}`} sub={t("kpi.fleetSub")} tone={o.devices.online < o.devices.total ? "warning" : "default"} href="/admin/devices" />
        <Kpi label={t("kpi.paper")} value={formatNumber(o.paperLow, locale)} sub={t("kpi.paperSub")} tone={o.paperLow ? "warning" : "default"} href="/admin/alerts" />
        <Kpi label={t("kpi.repeat")} value={`${o.repeatRate.toFixed(0)}%`} sub={t("kpi.repeatSub", { graves: o.activeGraves })} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Panel title={t("charts.daily")} action={<span className="flex items-center gap-3 text-xs text-charcoal-500"><span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-midnight-700" />{t("charts.orders")}</span><span className="inline-flex items-center gap-1"><span className="size-2 rounded-sm bg-gold-400" />{t("charts.delivered")}</span></span>}>
          <BarChart data={o.series} label={t("charts.daily")} />
        </Panel>
        <Panel title={t("revenue.title")}>
          {o.cur.revenue.length === 0 ? (
            <p className="text-sm text-charcoal-500">{tc("empty")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-charcoal-500">
                <tr>
                  <th className="pb-2 text-start font-medium">{t("revenue.currency")}</th>
                  <th className="pb-2 text-end font-medium">{t("revenue.gross")}</th>
                  <th className="pb-2 text-end font-medium">{t("revenue.refunds")}</th>
                  <th className="pb-2 text-end font-medium">{t("revenue.aov")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--line)]">
                {o.cur.revenue.map((r) => (
                  <tr key={r.currency}>
                    <td className="py-2 font-medium">{r.currency}</td>
                    <td className="py-2 text-end tabular">{formatMoney(r.gross, r.currency, locale)}</td>
                    <td className="py-2 text-end tabular text-oxblood-600">{r.refunded ? <bdi dir="ltr">−{formatMoney(r.refunded, r.currency, locale)}</bdi> : "—"}</td>
                    <td className="py-2 text-end tabular">{formatMoney(Math.round(r.gross / Math.max(1, r.count)), r.currency, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-4 text-xs text-charcoal-500">{t("revenue.note")}</p>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title={t("breakdown.graves")}>
          <ul className="space-y-3">
            {o.byGrave.map((r) => (
              <li key={r.k}>
                <div className="flex justify-between text-sm"><span>{r.k}</span><span className="tabular text-charcoal-600">{r.n}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-stone-200"><div className="h-full rounded-full bg-midnight-700" style={{ width: `${(r.n / maxGrave) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("breakdown.languages")}>
          <ul className="space-y-3">
            {o.byLocale.map((r) => (
              <li key={r.k}>
                <div className="flex justify-between text-sm"><span lang={r.k}>{LOCALE_NATIVE[r.k as AppLocale] ?? r.k}</span><span className="tabular text-charcoal-600">{r.n}</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-stone-200"><div className="h-full rounded-full bg-gold-500" style={{ width: `${(r.n / maxLocale) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={t("breakdown.geography")}>
          <ul className="divide-y divide-[var(--line)] text-sm">
            {o.byCountry.slice(0, 8).map((r) => (
              <li key={r.k} className="flex justify-between py-2"><span>{r.k === "—" ? "—" : countryName(r.k, locale)}</span><span className="tabular text-charcoal-600">{r.n}</span></li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-charcoal-500">{t("breakdown.geoNote")}</p>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title={t("alerts.title")} action={<Link href="/admin/alerts" className="text-sm text-gold-700 hover:underline">{t("alerts.all")}</Link>}>
          {o.openAlerts.length === 0 ? <p className="text-sm text-sage-600">{t("alerts.none")}</p> : (
            <ul className="space-y-2 text-sm">
              {o.openAlerts.map((a) => (
                <li key={a.kind + a.severity} className="flex items-center justify-between rounded-md bg-ivory-200/60 px-3 py-2">
                  <span className="flex items-center gap-2"><span className={cn("size-2 rounded-full", a.severity === "critical" ? "bg-oxblood-600" : a.severity === "warning" ? "bg-ochre-600" : "bg-ink-600")} />{t(`alerts.kinds.${a.kind}`)}</span>
                  <span className="tabular">{a.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title={t("funnel.title")}>
          <p className="text-sm leading-relaxed text-charcoal-600">{t("funnel.body")}</p>
        </Panel>
      </div>
    </>
  );
}
