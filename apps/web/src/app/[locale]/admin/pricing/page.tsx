import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { coupons, graves, graveTranslations, prices } from "@kvittel/db";
import { BundleForm, CouponForm, EndOverride, PriceCell } from "@/components/admin/AdminForms";
import { PageHeader, Panel, Table, Td } from "@/components/admin/kit";
import { Badge } from "@/components/ui";
import { CURRENCIES } from "@/i18n/locales";
import { formatDateTime, formatMoney } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { getDb } from "@/server/db";

export default async function PricingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "pricing.read", "/admin/pricing");
  const canWrite = s.permissions.has("pricing.write");
  const t = await getTranslations("admin.pricing");
  const db = await getDb();
  const now = new Date();
  const active = await db.select().from(prices).where(and(lte(prices.validFrom, now), or(isNull(prices.validTo), gt(prices.validTo, now))));
  const history = await db.select().from(prices).orderBy(desc(prices.createdAt)).limit(30);
  const cps = await db.select().from(coupons).orderBy(desc(coupons.createdAt));
  const gs = await db.select({ id: graves.id, slug: graves.slug }).from(graves);
  const names = await db.select().from(graveTranslations).where(eq(graveTranslations.locale, locale));
  const gName = (id: string | null) => (id ? (names.find((n) => n.graveId === id)?.name ?? gs.find((g) => g.id === id)?.slug ?? id) : "—");
  const def = (item: string, c: string) => active.find((p) => p.scope === "default" && p.item === item && p.currency === c);
  const overrides = active.filter((p) => p.scope === "grave");
  const bundle = active.find((p) => p.item === "bundle_discount_bps");

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title={t("defaults")} padded={false}>
          <Table head={[t("currency"), t("kvittel"), t("extraPage")]}>
            {CURRENCIES.map((c) => (
              <tr key={c}>
                <Td className="font-medium">{c}</Td>
                <Td>
                  <PriceCell scope="default" item="kvittel" currency={c} amountMinor={def("kvittel", c)?.amountMinor ?? null} canWrite={canWrite} />
                </Td>
                <Td>
                  <PriceCell scope="default" item="extra_page" currency={c} amountMinor={def("extra_page", c)?.amountMinor ?? null} canWrite={canWrite} />
                </Td>
              </tr>
            ))}
          </Table>
          <p className="px-5 py-3 text-xs text-charcoal-500">{t("noFx")}</p>
        </Panel>
        <div className="space-y-6">
          <Panel title={t("bundle")}>
            <BundleForm bps={bundle?.amountMinor ?? 0} canWrite={canWrite} />
            <p className="mt-3 text-xs text-charcoal-500">{t("bundleHint")}</p>
          </Panel>
          <Panel title={t("overrides")}>
            {overrides.length === 0 ? (
              <p className="text-sm text-charcoal-500">—</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {overrides.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-3">
                    <span>
                      <bdi>{gName(o.graveId)}</bdi> · {o.item} · <span className="tabular">{formatMoney(o.amountMinor, o.currency, locale)}</span> <span className="text-xs text-charcoal-500">v{o.version}</span>
                    </span>
                    {canWrite && <EndOverride priceId={o.id} />}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <div className="mt-4 border-t border-[var(--line)] pt-4">
                <p className="mb-2 text-xs text-charcoal-500">{t("addOverride")}</p>
                <div className="space-y-2">
                  {gs.map((g) => (
                    <details key={g.id} className="text-sm">
                      <summary className="cursor-pointer">
                        <bdi>{gName(g.id)}</bdi>
                      </summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {CURRENCIES.map((c) => (
                          <label key={c} className="flex items-center justify-between gap-2 text-xs">
                            {c}
                            <PriceCell scope="grave" graveId={g.id} item="kvittel" currency={c} amountMinor={overrides.find((o) => o.graveId === g.id && o.currency === c && o.item === "kvittel")?.amountMinor ?? null} canWrite />
                          </label>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </div>
      <Panel title={t("coupons")} className="mt-6">
        {canWrite && (
          <div className="mb-5">
            <CouponForm />
          </div>
        )}
        <Table head={[t("coupon.code"), t("coupon.kind"), t("coupon.value"), t("coupon.used"), t("coupon.validTo"), t("coupon.state")]}>
          {cps.map((c) => (
            <tr key={c.id}>
              <Td className="font-mono">{c.code}</Td>
              <Td>{t(`coupon.${c.kind}`)}</Td>
              <Td className="tabular">{c.kind === "percent" ? `${c.value / 100}%` : formatMoney(c.value, c.currency ?? "USD", locale)}</Td>
              <Td className="tabular">
                {c.redeemedCount}
                {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}
              </Td>
              <Td>{c.validTo ? formatDateTime(c.validTo, locale) : "—"}</Td>
              <Td>
                <Badge tone={c.active ? "success" : "neutral"}>{c.active ? t("coupon.on") : t("coupon.off")}</Badge>
              </Td>
            </tr>
          ))}
        </Table>
      </Panel>
      <Panel title={t("history")} className="mt-6" padded={false}>
        <Table head={[t("historyCols.when"), t("historyCols.scope"), t("historyCols.item"), t("currency"), t("historyCols.amount"), t("historyCols.version"), t("historyCols.until")]}>
          {history.map((p) => (
            <tr key={p.id}>
              <Td className="whitespace-nowrap tabular">{formatDateTime(p.createdAt, locale)}</Td>
              <Td>{p.scope === "grave" ? <bdi>{gName(p.graveId)}</bdi> : t("default")}</Td>
              <Td>{p.item}</Td>
              <Td>{p.currency}</Td>
              <Td className="tabular">{p.item === "bundle_discount_bps" ? `${p.amountMinor / 100}%` : formatMoney(p.amountMinor, p.currency === "ANY" ? "USD" : p.currency, locale)}</Td>
              <Td>v{p.version}</Td>
              <Td>{p.validTo ? formatDateTime(p.validTo, locale) : <Badge tone="success">{t("current")}</Badge>}</Td>
            </tr>
          ))}
        </Table>
      </Panel>
      <p className="mt-3 text-xs text-charcoal-500">{t("snapshotNote")}</p>
    </>
  );
}
