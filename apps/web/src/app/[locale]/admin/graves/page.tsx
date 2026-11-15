import { asc } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { graves, graveTranslations, locations } from "@kvittel/db";
import { PageHeader, Panel, Table, Td } from "@/components/admin/kit";
import { AvailabilityBadge } from "@/components/graves/GraveCard";
import { Badge, DemoBadge, buttonClass } from "@/components/ui";
import { CORE_LOCALES } from "@/i18n/locales";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { getDb } from "@/server/db";
import { listGraves } from "@/server/graves";

export default async function AdminGraves({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "graves.read", "/admin/graves");
  const t = await getTranslations("admin.graves");
  const db = await getDb();
  const all = await db.select().from(graves).orderBy(asc(graves.sortOrder));
  const tr = await db.select({ graveId: graveTranslations.graveId, locale: graveTranslations.locale, name: graveTranslations.name, reviewed: graveTranslations.reviewed }).from(graveTranslations);
  const locs = await db.select().from(locations);
  const cards = await listGraves(locale);
  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} actions={s.permissions.has("graves.write") ? <Link href="/admin/graves/new" className={buttonClass("primary", "sm")}>{t("new")}</Link> : undefined} />
      <Panel padded={false}>
        <Table head={[t("cols.name"), t("cols.status"), t("cols.availability"), t("cols.location"), t("cols.translations"), t("cols.permit"), t("cols.demand")]} caption={t("title")}>
          {all.map((g) => {
            const mine = tr.filter((x) => x.graveId === g.id);
            const name = (mine.find((x) => x.locale === locale) ?? mine.find((x) => x.locale === "en") ?? mine[0])?.name ?? g.slug;
            const loc = locs.find((l) => l.id === g.locationId);
            const card = cards.find((c) => c.id === g.id);
            return (
              <tr key={g.id} className="hover:bg-ivory-200/50">
                <Td>
                  <Link href={`/admin/graves/${g.id}`} className="font-medium text-midnight-900 underline-offset-4 hover:underline"><bdi>{name}</bdi></Link>
                  <span className="ms-2 font-mono text-xs text-charcoal-500">{g.slug}</span>
                  {g.isDemo && <DemoBadge className="ms-2" />}
                  {!g.publishedAt && <Badge className="ms-2">{t("draft")}</Badge>}
                </Td>
                <Td><Badge tone={g.status === "active" ? "success" : g.status === "maintenance" || g.status === "paused" ? "warning" : "neutral"}>{t(`status.${g.status}`)}</Badge></Td>
                <Td>{card ? <AvailabilityBadge a={card.availability} /> : "—"}</Td>
                <Td className="text-charcoal-600">{loc ? countryName(loc.countryCode, locale) : "—"}{loc && !loc.verified && <span className="ms-1 text-xs text-ochre-600">({t("unverified")})</span>}</Td>
                <Td>
                  <div className="flex gap-1">
                    {CORE_LOCALES.map((l) => {
                      const x = mine.find((m) => m.locale === l);
                      return <span key={l} title={x ? (x.reviewed ? t("reviewed") : t("unreviewed")) : t("missing")} className={`rounded px-1.5 py-0.5 font-mono text-[0.65rem] uppercase ${x ? (x.reviewed ? "bg-sage-100 text-sage-600" : "bg-ochre-100 text-ochre-600") : "bg-oxblood-100 text-oxblood-600"}`}>{l}</span>;
                    })}
                  </div>
                </Td>
                <Td className="text-charcoal-600">{t(`permit.${g.permitStatus}`)}</Td>
                <Td className="tabular text-charcoal-600">{g.demandCount}</Td>
              </tr>
            );
          })}
        </Table>
      </Panel>
    </>
  );
}
