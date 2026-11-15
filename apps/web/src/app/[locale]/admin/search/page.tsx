import { desc, ilike, or } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { devices, orders } from "@kvittel/db";
import { PageHeader, Panel } from "@/components/admin/kit";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { getDb } from "@/server/db";
import { searchGraves } from "@/server/graves";

export default async function AdminSearch({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "admin.access", "/admin/search");
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const t = await getTranslations("admin.search");
  const db = await getDb();
  const like = `%${q.replace(/[%_]/g, "")}%`;
  const os = q && s.permissions.has("orders.read") ? await db.select().from(orders).where(or(ilike(orders.publicRef, like), ilike(orders.email, like))).orderBy(desc(orders.createdAt)).limit(10) : [];
  const gs = q && s.permissions.has("graves.read") ? await searchGraves(q, locale) : [];
  const ds = q && s.permissions.has("devices.read") ? await db.select().from(devices).where(or(ilike(devices.name, like), ilike(devices.serial, like))).limit(10) : [];
  return (
    <>
      <PageHeader title={t("title", { q })} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title={t("orders", { n: os.length })}>
          <ul className="space-y-2 text-sm">
            {os.map((o) => <li key={o.id}><Link href={`/admin/orders/${o.publicRef}`} className="font-mono hover:underline"><bdi>{o.publicRef}</bdi></Link> · <bdi dir="ltr">{o.email}</bdi> · {formatMoney(o.totalMinor, o.currency, locale)}</li>)}
          </ul>
        </Panel>
        <Panel title={t("graves", { n: gs.length })}>
          <ul className="space-y-2 text-sm">{gs.map((g) => <li key={g.id}><Link href={`/admin/graves/${g.id}`} className="hover:underline"><bdi>{g.name}</bdi></Link></li>)}</ul>
        </Panel>
        <Panel title={t("devices", { n: ds.length })}>
          <ul className="space-y-2 text-sm">{ds.map((d) => <li key={d.id}><Link href={`/admin/devices/${d.id}`} className="hover:underline">{d.name}</Link> <span className="font-mono text-xs text-charcoal-500">{d.serial}</span></li>)}</ul>
        </Panel>
      </div>
    </>
  );
}
