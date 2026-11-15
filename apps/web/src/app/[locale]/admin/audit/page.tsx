import { desc, ilike } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auditLogs, users } from "@kvittel/db";
import { PageHeader, Panel, Table, Td } from "@/components/admin/kit";
import { buttonClass } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { getDb } from "@/server/db";

export default async function AuditPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ action?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await guardPage(locale, "audit.read", "/admin/audit");
  const { action } = await searchParams;
  const t = await getTranslations("admin.audit");
  const tc = await getTranslations("admin.common");
  const db = await getDb();
  const rows = await db.select().from(auditLogs).where(action ? ilike(auditLogs.action, `%${action.replace(/[%_]/g, "")}%`) : undefined).orderBy(desc(auditLogs.createdAt)).limit(200);
  const us = await db.select({ id: users.id, email: users.email }).from(users);
  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <Panel padded={false}>
        <form method="get" className="flex gap-3 border-b border-[var(--line)] p-4">
          <input name="action" defaultValue={action} placeholder={t("filterPh")} aria-label={tc("filter")} className="h-10 min-w-0 flex-1 rounded-md border border-[var(--line-strong)] bg-ivory-50 px-3 font-mono text-sm" dir="ltr" />
          <button className={buttonClass("primary", "sm", "h-10")}>{tc("filter")}</button>
        </form>
        <Table head={[t("cols.when"), t("cols.actor"), t("cols.action"), t("cols.target"), t("cols.reason")]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap tabular">{formatDateTime(r.createdAt, locale, undefined, { dateStyle: "short", timeStyle: "medium" })}</Td>
              <Td className="text-charcoal-600"><bdi dir="ltr">{r.actorUserId ? (us.find((u) => u.id === r.actorUserId)?.email ?? r.actorUserId.slice(0, 8)) : r.actorKind}</bdi></Td>
              <Td className="font-mono text-xs">{r.action}</Td>
              <Td className="font-mono text-xs text-charcoal-600">{r.targetType ? `${r.targetType}:${(r.targetId ?? "").slice(0, 12)}` : "—"}</Td>
              <Td className="max-w-72 text-xs text-charcoal-600">{r.reason ?? "—"}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
      <p className="mt-3 text-xs text-charcoal-500">{t("note")}</p>
    </>
  );
}
