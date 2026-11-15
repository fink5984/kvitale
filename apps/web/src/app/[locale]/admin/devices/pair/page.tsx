import { getTranslations, setRequestLocale } from "next-intl/server";
import { PairForm } from "@/components/admin/fleet/FleetClient";
import { PageHeader, Panel, Table, Td } from "@/components/admin/kit";
import { Badge } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { allGravesForSelect, listPairingCodes } from "@/server/fleet-queries";

export const dynamic = "force-dynamic";

export default async function PairPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "devices.provision", "/admin/devices/pair");
  const t = await getTranslations("admin.fleet");
  const [graves, codes] = await Promise.all([allGravesForSelect(locale, s.graveScope), listPairingCodes(locale)]);
  return (
    <>
      <PageHeader crumbs={[{ href: "/admin/devices", label: t("detail.crumbs") }, { label: t("pair.title") }]} eyebrow={t("eyebrow")} title={t("pair.title")} description={t("pair.description")} />
      <Panel>
        <PairForm graves={graves.map((g) => ({ id: g.id, name: g.name }))} />
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Panel title={t("pair.stepsTitle")}>
          <ol className="space-y-4 text-sm leading-relaxed text-charcoal-700">
            {(["step1", "step2", "step3", "step4"] as const).map((k, i) => (
              <li key={k} className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-midnight-900 text-[0.7rem] font-semibold text-gold-200">{i + 1}</span>
                <div className="min-w-0">
                  <p>{t(`pair.${k}`)}</p>
                  {k === "step2" && (
                    <code className="mt-2 block break-all rounded-md bg-midnight-900 px-3 py-2 font-mono text-[0.72rem] text-gold-200" dir="ltr">
                      kvittel-agent pair --code XXXX-XXXX --server https://…
                    </code>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={t("pair.recentTitle")} action={<span className="text-xs text-charcoal-500">{t("pair.recentHint")}</span>} padded={false}>
          {codes.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-charcoal-500">{t("pair.noCodes")}</p>
          ) : (
            <Table head={[t("pair.deviceName"), t("pair.grave"), t("alerts.colState"), t("alerts.colOpened")]}>
              {codes.map((c) => (
                <tr key={c.id}>
                  <Td>{c.deviceName}</Td>
                  <Td>{c.graveName ? <bdi>{c.graveName}</bdi> : "—"}</Td>
                  <Td>
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={c.state === "used" ? "success" : c.state === "pending" ? "gold" : "neutral"}>{t(`pair.state.${c.state}`)}</Badge>
                      {c.deviceId && (
                        <Link href={`/admin/devices/${c.deviceId}`} className="text-xs underline underline-offset-2">
                          {t("pair.openUnit")}
                        </Link>
                      )}
                    </span>
                  </Td>
                  <Td className="text-xs text-charcoal-500 tabular">{formatDateTime(c.createdAt, locale)}</Td>
                </tr>
              ))}
            </Table>
          )}
        </Panel>
      </div>
    </>
  );
}
