import { eq, isNull, and } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { graves, graveTranslations, partnerAgreements, partnerGraves, partners, roleAssignments, users } from "@kvittel/db";
import { PartnerForm, PartnerScope } from "@/components/admin/AdminForms";
import { PageHeader, Panel } from "@/components/admin/kit";
import { Badge, DemoBadge } from "@/components/ui";
import { guardPage } from "@/server/admin-guard";
import { getDb } from "@/server/db";

export default async function PartnersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  await guardPage(locale, "partners.manage", "/admin/partners");
  const t = await getTranslations("admin.partners");
  const tr = await getTranslations("admin.nav.roles");
  const db = await getDb();
  const ps = await db.select().from(partners);
  const pg = await db.select().from(partnerGraves);
  const ags = await db.select().from(partnerAgreements);
  const gs = await db.select({ id: graves.id, slug: graves.slug }).from(graves);
  const names = await db.select().from(graveTranslations).where(eq(graveTranslations.locale, locale));
  const people = await db.select({ email: users.email, role: roleAssignments.role, partnerId: roleAssignments.partnerId }).from(roleAssignments).innerJoin(users, eq(users.id, roleAssignments.userId)).where(and(isNull(roleAssignments.revokedAt)));
  const graveList = gs.map((g) => ({ id: g.id, name: names.find((n) => n.graveId === g.id)?.name ?? g.slug }));
  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <div className="grid gap-6 lg:grid-cols-2">
        {ps.map((p) => (
          <Panel key={p.id} title={<span className="flex items-center gap-2">{p.name}{p.isDemo && <DemoBadge />}</span>} action={<Badge>{t(`kinds.${p.kind}`)}</Badge>}>
            <p className="text-sm text-charcoal-600"><bdi dir="ltr">{p.contactEmail ?? "—"}</bdi> · {p.locale}</p>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal-500">{t("scope")}</p>
              <PartnerScope partnerId={p.id} graves={graveList} selected={pg.filter((x) => x.partnerId === p.id).map((x) => x.graveId)} />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-charcoal-500">{t("people")}</p>
              <ul className="space-y-1 text-sm">
                {people.filter((x) => x.partnerId === p.id).map((x) => <li key={x.email + x.role}><bdi dir="ltr">{x.email}</bdi> · {tr(x.role)}</li>)}
                {!people.some((x) => x.partnerId === p.id) && <li className="text-charcoal-500">—</li>}
              </ul>
            </div>
            {ags.filter((a) => a.partnerId === p.id).map((a) => (
              <p key={a.id} className="mt-4 text-sm">{t("agreement", { pct: a.revenueShareBps / 100, currency: a.currency })}</p>
            ))}
            <p className="mt-4 text-xs text-charcoal-500">{t("noContent")}</p>
          </Panel>
        ))}
      </div>
      <Panel title={t("new")} className="mt-6">
        <PartnerForm graves={graveList} />
      </Panel>
    </>
  );
}
