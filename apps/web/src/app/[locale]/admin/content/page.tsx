import { desc } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { graveRequests, pages, pageTranslations } from "@kvittel/db";
import { PageEditor } from "@/components/admin/AdminForms";
import { PageHeader, Panel, Table, Td } from "@/components/admin/kit";
import { buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { getDb } from "@/server/db";

const LOCALES = ["he", "en", "fr", "ru", "yi", "es", "pt", "de"];

export default async function ContentPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "content.write", "/admin/content");
  const t = await getTranslations("admin.content");
  const db = await getDb();
  const ps = await db.select().from(pages);
  const trs = await db.select().from(pageTranslations);
  const reqs = await db.select().from(graveRequests).orderBy(desc(graveRequests.createdAt)).limit(30);
  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <div className="space-y-6">
        {ps.map((p) => (
          <Panel key={p.id} title={<span className="font-mono text-sm">/legal/{p.slug}</span>} action={<Link href={`/legal/${p.slug}`} className={buttonClass("ghost", "sm")} target="_blank">{t("view")}</Link>}>
            <PageEditor
              slug={p.slug}
              locales={LOCALES}
              canWrite={s.permissions.has("content.write")}
              initial={Object.fromEntries(trs.filter((x) => x.pageId === p.id).map((x) => [x.locale, { title: x.title, body: x.body, reviewed: x.reviewed }]))}
            />
          </Panel>
        ))}
        <Panel title={t("requests")} padded={false}>
          <Table head={[t("reqCols.name"), t("reqCols.location"), t("reqCols.locale"), t("reqCols.when")]}>
            {reqs.map((r) => (
              <tr key={r.id}>
                <Td><bdi>{r.nameText}</bdi></Td>
                <Td className="text-charcoal-600"><bdi>{r.locationText ?? "—"}</bdi></Td>
                <Td>{r.locale}</Td>
                <Td className="tabular">{formatDateTime(r.createdAt, locale)}</Td>
              </tr>
            ))}
          </Table>
          {reqs.length === 0 && <p className="p-5 text-sm text-charcoal-500">—</p>}
        </Panel>
        <p className="text-xs text-charcoal-500">{t("uiStringsNote")}</p>
      </div>
    </>
  );
}
