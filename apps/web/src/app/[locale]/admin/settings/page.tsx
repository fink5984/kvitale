import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { and, eq, isNull } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { featureFlags, partners, roleAssignments, users } from "@kvittel/db";
import { FlagToggle, GrantRole, RevokeRole, Tabs } from "@/components/admin/AdminForms";
import { PageHeader, Panel, Table, Td } from "@/components/admin/kit";
import { Badge, DemoBadge } from "@/components/ui";
import { ENABLED_LOCALES, EXTRA_LOCALES, LOCALE_NATIVE, type AppLocale } from "@/i18n/locales";
import { guardPage } from "@/server/admin-guard";
import { getDb } from "@/server/db";
import { integrationStatus } from "@/server/env";

/** Coverage = keys present AND different from English (identical text is treated as untranslated placeholder). */
function coverage() {
  const base = path.join(process.cwd(), "messages");
  const load = (l: string) => {
    const out: Record<string, string> = {};
    for (const f of readdirSync(path.join(base, l)).filter((x) => x.endsWith(".json"))) {
      const j = JSON.parse(readFileSync(path.join(base, l, f), "utf8"));
      const walk = (o: unknown, p: string) => {
        if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) walk(v, p ? `${p}.${k}` : k);
        else out[p] = String(o);
      };
      walk(j, "");
    }
    return out;
  };
  const en = load("en");
  const keys = Object.keys(en);
  return ["he", "fr", "ru", "yi", "es", "pt", "de"].map((l) => {
    const m = load(l);
    const present = keys.filter((k) => k in m).length;
    const translated = keys.filter((k) => k in m && m[k] !== en[k]).length;
    return { locale: l, total: keys.length, present, translated };
  });
}

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "settings.write", "/admin/settings");
  const tab = (await searchParams).tab ?? "integrations";
  const t = await getTranslations("admin.settings");
  const tr = await getTranslations("admin.nav.roles");
  const db = await getDb();
  const flags = await db.select().from(featureFlags);
  const assignments = await db.select({ id: roleAssignments.id, role: roleAssignments.role, email: users.email, partnerId: roleAssignments.partnerId, isDemo: users.isDemo }).from(roleAssignments).innerJoin(users, eq(users.id, roleAssignments.userId)).where(and(isNull(roleAssignments.revokedAt)));
  const ps = await db.select({ id: partners.id, name: partners.name }).from(partners);
  const base = `/${locale}/admin/settings`;

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <Tabs base={base} current={tab} tabs={["integrations", "flags", "roles", "localization"].map((k) => ({ key: k, label: t(`tabs.${k}`) }))} />

      {tab === "integrations" && (
        <Panel padded={false}>
          <Table head={[t("int.name"), t("int.status"), t("int.detail")]}>
            {integrationStatus().map((i) => (
              <tr key={i.key}>
                <Td className="font-medium">{t(`int.keys.${i.key}`)}</Td>
                <Td><Badge tone={i.status === "configured" || i.status === "embedded" ? "success" : i.status === "mock" || i.status === "simulated" ? "warning" : "neutral"}>{t(`int.states.${i.status}`)}</Badge></Td>
                <Td className="text-charcoal-600">{i.detail}</Td>
              </tr>
            ))}
          </Table>
          <p className="p-5 text-xs text-charcoal-500">{t("int.note")}</p>
        </Panel>
      )}

      {tab === "flags" && (
        <Panel padded={false}>
          <ul className="divide-y divide-[var(--line)]">
            {flags.map((f) => (
              <li key={f.key} className="flex items-center justify-between gap-6 px-5 py-4">
                <div>
                  <p className="font-mono text-sm">{f.key}</p>
                  <p className="text-sm text-charcoal-500">{f.description}</p>
                </div>
                <FlagToggle flag={f.key} enabled={f.enabled} canWrite={s.permissions.has("flags.write")} />
              </li>
            ))}
          </ul>
          <p className="p-5 text-xs text-charcoal-500">{t("flagsNote")}</p>
        </Panel>
      )}

      {tab === "roles" && (
        <div className="space-y-6">
          {s.permissions.has("roles.write") && (
            <Panel title={t("roles.grantTitle")}>
              <GrantRole partners={ps} />
            </Panel>
          )}
          <Panel padded={false}>
            <Table head={[t("roles.email"), t("roles.role"), t("roles.partner"), ""]}>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <Td><bdi dir="ltr">{a.email}</bdi>{a.isDemo && <DemoBadge className="ms-2" />}</Td>
                  <Td>{tr(a.role)}</Td>
                  <Td>{ps.find((p) => p.id === a.partnerId)?.name ?? "—"}</Td>
                  <Td>{s.permissions.has("roles.write") && <RevokeRole id={a.id} />}</Td>
                </tr>
              ))}
            </Table>
          </Panel>
          <p className="text-xs text-charcoal-500">{t("roles.note")}</p>
        </div>
      )}

      {tab === "localization" && (
        <Panel padded={false}>
          <Table head={[t("loc.language"), t("loc.state"), t("loc.coverage"), t("loc.keys")]}>
            {coverage().map((c) => {
              const pct = Math.round((c.translated / c.total) * 100);
              const enabled = (ENABLED_LOCALES as string[]).includes(c.locale);
              return (
                <tr key={c.locale}>
                  <Td><span lang={c.locale}>{LOCALE_NATIVE[c.locale as AppLocale]}</span> <span className="font-mono text-xs text-charcoal-500">{c.locale}</span></Td>
                  <Td><Badge tone={enabled ? "success" : "neutral"}>{enabled ? t("loc.enabled") : (EXTRA_LOCALES as readonly string[]).includes(c.locale) ? t("loc.awaitingQa") : t("loc.disabled")}</Badge></Td>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="h-1.5 w-40 rounded-full bg-stone-200"><div className={pct > 95 ? "h-full rounded-full bg-sage-600" : "h-full rounded-full bg-ochre-600"} style={{ width: `${pct}%` }} /></div>
                      <span className="tabular text-sm">{pct}%</span>
                    </div>
                  </Td>
                  <Td className="tabular text-charcoal-600">{c.translated} / {c.total}</Td>
                </tr>
              );
            })}
          </Table>
          <p className="p-5 text-xs text-charcoal-500">{t("loc.note")}</p>
        </Panel>
      )}
    </>
  );
}
