import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader, Panel, STATUS_TONE, Table, Td } from "@/components/admin/kit";
import { Badge, DemoBadge, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatDateTime, formatMoney } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { listOrders, orderStatusCounts } from "@/server/admin-orders";
import { listGraves } from "@/server/graves";


type SP = { q?: string; status?: string; grave?: string; from?: string; to?: string; page?: string };

export default async function AdminOrders({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SP> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await guardPage(locale, "orders.read", "/admin/orders");
  const sp = await searchParams;
  const t = await getTranslations("admin.orders");
  const tc = await getTranslations("admin.common");
  const ts = await getTranslations("status.order");
  const ti = await getTranslations("status.item");
  const [res, counts, graves] = await Promise.all([listOrders({ ...sp, page: Number(sp.page ?? 1) }), orderStatusCounts(), listGraves(locale)]);
  const qs = (patch: Partial<SP>) => {
    const n = new URLSearchParams(Object.entries({ ...sp, ...patch }).filter(([, v]) => v) as Array<[string, string]>);
    return `/admin/orders?${n.toString()}`;
  };
  const exportHref = `/api/admin/export/orders?${new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as Array<[string, string]>).toString()}`;

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} actions={<a href={exportHref} className={buttonClass("outline", "sm")}>{tc("export")}</a>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {["all", "paid", "in_fulfillment", "attention", "fulfilled", "refunded", "pending_payment"].map((s) => (
          <Link key={s} href={qs({ status: s === "all" ? undefined : s, page: undefined })} className={`rounded-full border px-3 py-1 text-sm ${(sp.status ?? "all") === s ? "border-midnight-900 bg-midnight-900 text-ivory-50" : "border-[var(--line-strong)] bg-ivory-50 text-charcoal-700 hover:border-stone-400"}`}>
            {s === "all" ? tc("all") : ts(s)} {s !== "all" && <span className="ms-1 opacity-60 tabular">{counts[s] ?? 0}</span>}
          </Link>
        ))}
      </div>
      <Panel padded={false}>
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-[var(--line)] p-4">
          <label className="flex min-w-60 flex-1 flex-col gap-1 text-xs text-charcoal-500">
            {t("search")}
            <input name="q" defaultValue={sp.q} placeholder={t("searchPh")} className="h-10 rounded-md border border-[var(--line-strong)] bg-ivory-50 px-3 text-sm text-midnight-900" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-charcoal-500">
            {t("grave")}
            <select name="grave" defaultValue={sp.grave ?? ""} className="h-10 rounded-md border border-[var(--line-strong)] bg-ivory-50 px-3 text-sm text-midnight-900">
              <option value="">{tc("all")}</option>
              {graves.map((g) => <option key={g.slug} value={g.slug}>{g.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-charcoal-500">
            {t("from")}
            <input type="date" name="from" defaultValue={sp.from} className="h-10 rounded-md border border-[var(--line-strong)] bg-ivory-50 px-3 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-charcoal-500">
            {t("to")}
            <input type="date" name="to" defaultValue={sp.to} className="h-10 rounded-md border border-[var(--line-strong)] bg-ivory-50 px-3 text-sm" />
          </label>
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <button className={buttonClass("primary", "sm", "h-10")}>{tc("filter")}</button>
        </form>
        <Table head={[t("cols.ref"), t("cols.created"), t("cols.customer"), t("cols.deliveries"), t("cols.status"), t("cols.total")]} caption={t("title")}>
          {res.rows.map((o) => (
            <tr key={o.id} className="hover:bg-ivory-200/50">
              <Td>
                <Link href={`/admin/orders/${o.publicRef}`} className="font-mono text-[0.82rem] font-medium text-midnight-900 underline-offset-4 hover:underline">
                  <bdi>{o.publicRef}</bdi>
                </Link>
                {o.isDemo && <DemoBadge className="ms-2" />}
              </Td>
              <Td className="whitespace-nowrap text-charcoal-600 tabular">{formatDateTime(o.createdAt, locale)}</Td>
              <Td className="max-w-56 truncate text-charcoal-700" ><bdi dir="ltr">{o.email}</bdi></Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {o.items.map((i, k) => (
                    <span key={k} className="rounded bg-stone-100 px-1.5 py-0.5 text-[0.7rem] text-charcoal-700" title={ti(i.status)}>
                      {i.slug} · {ti(i.status)}
                    </span>
                  ))}
                </div>
              </Td>
              <Td><Badge tone={STATUS_TONE[o.status] ?? "neutral"}>{ts(o.status)}</Badge></Td>
              <Td className="text-end tabular whitespace-nowrap">{formatMoney(o.totalMinor, o.currency, locale)}</Td>
            </tr>
          ))}
        </Table>
        {res.rows.length === 0 && <p className="p-8 text-center text-sm text-charcoal-500">{tc("empty")}</p>}
        <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3 text-sm">
          <span className="text-charcoal-500">{tc("results", { count: res.total })} · {tc("page", { page: res.page, pages: res.pages })}</span>
          <span className="flex gap-2">
            {res.page > 1 && <Link className={buttonClass("outline", "sm")} href={qs({ page: String(res.page - 1) })}>{tc("prev")}</Link>}
            {res.page < res.pages && <Link className={buttonClass("outline", "sm")} href={qs({ page: String(res.page + 1) })}>{tc("next")}</Link>}
          </span>
        </div>
      </Panel>
      <p className="mt-3 text-xs text-charcoal-500">{t("privacyNote")}</p>
    </>
  );
}
