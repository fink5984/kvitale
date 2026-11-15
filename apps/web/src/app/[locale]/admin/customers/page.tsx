import { getTranslations, setRequestLocale } from "next-intl/server";
import { AnonymizeButton } from "@/components/admin/AdminForms";
import { PageHeader, Panel, Table, Td } from "@/components/admin/kit";
import { Badge, DemoBadge, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { customersList } from "@/server/admin-orders";

export default async function CustomersPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string; page?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "customers.read", "/admin/customers");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1));
  const t = await getTranslations("admin.customers");
  const tc = await getTranslations("admin.common");
  const rows = await customersList(sp.q, page);
  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <Panel padded={false}>
        <form method="get" className="flex gap-3 border-b border-[var(--line)] p-4">
          <input name="q" defaultValue={sp.q} placeholder={t("searchPh")} aria-label={tc("search")} className="h-10 min-w-0 flex-1 rounded-md border border-[var(--line-strong)] bg-ivory-50 px-3 text-sm" />
          <button className={buttonClass("primary", "sm", "h-10")}>{tc("search")}</button>
        </form>
        <Table head={[t("cols.email"), t("cols.type"), t("cols.orders"), t("cols.last"), t("cols.marketing"), tc("actions")]}>
          {rows.map((r) => (
            <tr key={r.email}>
              <Td>
                <Link href={`/admin/orders?q=${encodeURIComponent(r.email)}`} className="underline-offset-4 hover:underline">
                  <bdi dir="ltr">{r.email}</bdi>
                </Link>
                {r.demo && <DemoBadge className="ms-2" />}
              </Td>
              <Td><Badge tone={r.registered ? "info" : "neutral"}>{r.registered ? t("registered") : t("guest")}</Badge></Td>
              <Td className="tabular">{r.orders}</Td>
              <Td className="whitespace-nowrap tabular">{formatDateTime(r.last_order, locale)}</Td>
              <Td>{r.marketing ? <Badge tone="success">{t("optedIn")}</Badge> : "—"}</Td>
              <Td>{s.permissions.has("customers.manage") && <AnonymizeButton email={r.email} />}</Td>
            </tr>
          ))}
        </Table>
        <div className="flex justify-end gap-2 border-t border-[var(--line)] p-3">
          {page > 1 && <Link className={buttonClass("outline", "sm")} href={`/admin/customers?page=${page - 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}>{tc("prev")}</Link>}
          {rows.length === 25 && <Link className={buttonClass("outline", "sm")} href={`/admin/customers?page=${page + 1}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`}>{tc("next")}</Link>}
        </div>
      </Panel>
      <p className="mt-3 text-xs text-charcoal-500">{t("privacyNote")}</p>
    </>
  );
}
