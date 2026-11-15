import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConnBadge, PowerBadge, SensorBadge, SimBadge } from "@/components/admin/fleet/bits";
import { Kpi, Meter, PageHeader, Panel, Table, Td } from "@/components/admin/kit";
import { Badge, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn, relativeTime } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { listFleet, type FleetRow } from "@/server/fleet-queries";

export const dynamic = "force-dynamic";

type Filter = "all" | "online" | "attention" | "offline";

function needsAttention(r: FleetRow) {
  return r.openAlerts > 0 || r.connectivity === "offline" || r.connectivity === "heartbeat_missed" || r.status === "maintenance";
}
function paperLow(r: FleetRow) {
  return !!r.paper && (r.paper.remainingPct - r.paper.uncertaintyPct <= 15 || (r.paper.daysToEmpty !== null && r.paper.daysToEmpty <= 4) || r.paper.nearEndSensor === "near_end");
}

export default async function DevicesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ f?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "devices.read", "/admin/devices");
  const t = await getTranslations("admin.fleet");
  const { f: rawF } = await searchParams;
  const f: Filter = (["online", "attention", "offline"] as const).includes(rawF as "online") ? (rawF as Filter) : "all";
  const all = await listFleet(locale, s.graveScope);
  const rows = all.filter((r) => (f === "online" ? r.connectivity === "online" : f === "attention" ? needsAttention(r) : f === "offline" ? r.connectivity === "offline" || r.connectivity === "never_seen" : true));
  const online = all.filter((r) => r.connectivity === "online").length;
  const attention = all.filter(needsAttention).length;
  const low = all.filter(paperLow).length;
  const tt = t as unknown as (k: string, v?: Record<string, string | number>) => string;

  return (
    <>
      <PageHeader
        eyebrow={t("eyebrow")}
        title={t("list.title")}
        description={t("list.description")}
        actions={
          s.permissions.has("devices.provision") ? (
            <Link href="/admin/devices/pair" className={buttonClass("primary", "sm")}>
              {t("list.pairCta")}
            </Link>
          ) : undefined
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label={t("list.kpiOnline")} value={online} sub={t("list.kpiOnlineSub", { total: all.length })} href="/admin/devices?f=online" />
        <Kpi label={t("list.kpiAttention")} value={attention} sub={t("list.kpiAttentionSub")} tone={attention ? "warning" : "default"} href="/admin/devices?f=attention" />
        <Kpi label={t("list.kpiPaper")} value={low} sub={t("list.kpiPaperSub")} tone={low ? "danger" : "default"} href="/admin/alerts" />
      </div>

      <nav aria-label={t("list.title")} className="mt-8 flex flex-wrap gap-1.5">
        {(["all", "online", "attention", "offline"] as const).map((k) => (
          <Link key={k} href={k === "all" ? "/admin/devices" : `/admin/devices?f=${k}`} aria-current={f === k ? "page" : undefined} className={cn("rounded-full px-3.5 py-1.5 text-sm transition-colors", f === k ? "bg-midnight-900 text-ivory-50" : "bg-stone-100 text-charcoal-700 hover:bg-stone-200")}>
            {t(`list.filter${k[0]!.toUpperCase()}${k.slice(1)}` as "list.filterAll")}
          </Link>
        ))}
      </nav>

      <Panel className="mt-4" padded={false}>
        <Table head={[t("list.colUnit"), t("list.colGrave"), t("list.colConn"), t("list.colPaper"), t("list.colPower"), t("list.colSensors"), t("list.colVersion")]} caption={t("list.title")}>
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-ivory-200/40">
              <Td>
                <Link href={`/admin/devices/${r.id}`} className="font-medium text-midnight-900 underline-offset-4 hover:underline">
                  {r.name}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-[0.7rem] text-charcoal-500" dir="ltr">
                    {r.serial}
                  </span>
                  {r.simulated && <SimBadge t={tt} />}
                  {r.status !== "active" && <Badge tone={r.status === "maintenance" ? "warning" : "neutral"}>{t(`status.${r.status}` as "status.active")}</Badge>}
                  {r.paused && <Badge tone="info">{t("paused")}</Badge>}
                </div>
              </Td>
              <Td className="max-w-48">
                {r.graveName ? <bdi>{r.graveName}</bdi> : <span className="text-charcoal-500">{t("list.unassigned")}</span>}
              </Td>
              <Td>
                <ConnBadge c={r.connectivity} t={tt} />
                <p className="mt-1 text-xs text-charcoal-500">{r.lastSeenAt ? t("list.lastSeen", { when: relativeTime(r.lastSeenAt, locale) }) : t("list.neverSeen")}</p>
                {r.openAlerts > 0 && (
                  <Link href="/admin/alerts" className="mt-1 inline-block text-xs font-medium text-oxblood-600">
                    {t("list.alertsCount", { count: r.openAlerts })}
                  </Link>
                )}
              </Td>
              <Td className="min-w-40">
                {r.paper ? (
                  <>
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="tabular font-medium text-midnight-900">{t("list.paperPct", { pct: Math.round(r.paper.remainingPct), unc: r.paper.uncertaintyPct })}</span>
                    </div>
                    <div className="mt-1.5">
                      <Meter value={r.paper.remainingPct} label={t("list.colPaper")} tone={paperLow(r) ? "bad" : undefined} />
                    </div>
                    <p className="mt-1 text-xs text-charcoal-500">{r.paper.daysToEmpty !== null ? t("list.daysLeft", { days: Math.floor(r.paper.daysToEmpty) }) : t("list.noDemand")}</p>
                  </>
                ) : (
                  <span className="text-xs text-charcoal-500">{t("list.noRoll")}</span>
                )}
              </Td>
              <Td>
                <PowerBadge tele={r.tele} t={tt} />
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  <SensorBadge label={t("list.sensorCover")} value={r.tele.cover} t={tt} />
                  <SensorBadge label={t("list.sensorCutter")} value={r.tele.cutter} t={tt} />
                  <SensorBadge label={t("list.sensorChute")} value={r.tele.chuteSensor} t={tt} />
                </div>
              </Td>
              <Td className="font-mono text-xs" >
                <span dir="ltr">{r.agentVersion ?? "—"}</span>
              </Td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-charcoal-500">{t("list.empty")}</p>}
      </Panel>
    </>
  );
}
