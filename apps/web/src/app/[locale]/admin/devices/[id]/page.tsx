import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { ConnBadge, PowerBadge, SensorBadge, SimBadge } from "@/components/admin/fleet/bits";
import { AssignmentForm, CommandButtons, RevokeButton, RollChangeForm } from "@/components/admin/fleet/FleetClient";
import { Dl, LineChart, Meter, PageHeader, Panel } from "@/components/admin/kit";
import { Badge } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn, formatDate, formatDateTime, formatNumber, relativeTime } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { allGravesForSelect, deviceDetail } from "@/server/fleet-queries";

export const dynamic = "force-dynamic";

export default async function DevicePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "devices.read", `/admin/devices/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await deviceDetail(id, locale);
  if (!d) notFound();
  if (s.graveScope && (!d.current || !s.graveScope.includes(d.current.graveId))) redirect(`/${locale}/admin/forbidden`);
  const t = await getTranslations("admin.fleet");
  const ta = await getTranslations("admin.fleet.alerts");
  const ts = await getTranslations("status.item");
  const tt = t as unknown as (k: string, v?: Record<string, string | number>) => string;
  const dev = d.device;
  const graves = s.permissions.has("devices.provision") ? await allGravesForSelect(locale, s.graveScope) : [];
  const currentAssign = d.assigns.find((a) => !a.unassignedAt);
  const roll = d.rolls.find((r) => !r.removedAt);
  const series = (k: "signalDbm" | "latencyMs" | "queueDepth") => d.telemetry.map((p) => ({ x: p.at, y: typeof p.data[k] === "number" ? (p.data[k] as number) : null }));
  const revoked = dev.status === "revoked";

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/devices", label: t("detail.crumbs") }, { label: dev.name }]}
        eyebrow={t("eyebrow")}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {dev.name}
            {dev.isSimulated && <SimBadge t={tt} />}
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ConnBadge c={d.connectivity} t={tt} />
            <Badge tone={dev.status === "active" ? "success" : dev.status === "maintenance" ? "warning" : "neutral"}>{t(`status.${dev.status}` as "status.active")}</Badge>
            {dev.paused && <Badge tone="info">{t("paused")}</Badge>}
            <span className="text-charcoal-500">{dev.lastSeenAt ? t("list.lastSeen", { when: relativeTime(dev.lastSeenAt, locale) }) : t("list.neverSeen")}</span>
          </span>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Panel title={t("detail.telemetryTitle")}>
            {d.telemetry.length < 2 ? (
              <p className="py-6 text-center text-sm text-charcoal-500">{t("detail.telemetryEmpty")}</p>
            ) : (
              <div className="grid gap-6 md:grid-cols-3">
                <div>
                  <p className="mb-2 text-xs font-medium text-charcoal-600">{t("detail.signal")}</p>
                  <LineChart series={series("signalDbm")} label={t("detail.signal")} unit=" dBm" />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-charcoal-600">{t("detail.latency")}</p>
                  <LineChart series={series("latencyMs")} label={t("detail.latency")} unit=" ms" min={0} />
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium text-charcoal-600">{t("detail.queue")}</p>
                  <LineChart series={series("queueDepth")} label={t("detail.queue")} min={0} />
                </div>
              </div>
            )}
          </Panel>

          <Panel title={t("detail.alertsTitle")}>
            {d.openAlerts.length === 0 ? (
              <p className="text-sm text-charcoal-500">{t("detail.noAlerts")}</p>
            ) : (
              <ul className="space-y-2">
                {d.openAlerts.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--line)] px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Badge tone={a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "info"}>{ta(`severity.${a.severity}` as "severity.info")}</Badge>
                      {ta(`kind.${a.kind}` as "kind.paper_low")}
                    </span>
                    <span className="text-xs text-charcoal-500">{relativeTime(a.openedAt, locale)}</span>
                  </li>
                ))}
                <li>
                  <Link href="/admin/alerts" className="text-sm font-medium text-midnight-900 underline underline-offset-4">
                    {t("alerts.title")}
                  </Link>
                </li>
              </ul>
            )}
          </Panel>

          <Panel title={t("detail.jobsTitle")} action={<span className="text-xs text-charcoal-500">{t("detail.jobsHint")}</span>}>
            {d.jobs.length === 0 ? (
              <p className="text-sm text-charcoal-500">{t("detail.noJobs")}</p>
            ) : (
              <ul className="divide-y divide-[var(--line)] text-sm">
                {d.jobs.map((j) => (
                  <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <Badge tone={j.status === "delivered" ? "success" : j.status === "uncertain" || j.status === "failed" ? "danger" : "neutral"}>{ts(j.status === "leased" ? "sending" : (j.status as "queued"))}</Badge>
                      {j.isTest && <Badge tone="info">{t("detail.jobTest")}</Badge>}
                      <span className="text-xs text-charcoal-500">{t("detail.jobAttempt", { n: j.attempts })}</span>
                      {j.confidence && <span className="text-xs text-charcoal-500">· {t(`detail.jobConfidence.${j.confidence}` as "detail.jobConfidence.manual")}</span>}
                      {j.lastError && (
                        <code className="rounded bg-stone-100 px-1.5 py-0.5 text-[0.7rem] text-charcoal-600" dir="ltr">
                          {j.lastError}
                        </code>
                      )}
                    </span>
                    <span className="text-xs text-charcoal-500 tabular">
                      {j.lengthMm ? (
                        <>
                          <bdi dir="ltr">{Math.round(j.lengthMm)} mm</bdi>
                          {" · "}
                        </>
                      ) : null}
                      <bdi>{formatDateTime(j.createdAt, locale)}</bdi>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t("detail.eventsTitle")}>
            {d.events.length === 0 ? (
              <p className="text-sm text-charcoal-500">{t("detail.noEvents")}</p>
            ) : (
              <ol className="relative space-y-3 border-s border-stone-300 ps-5">
                {d.events.map((e) => (
                  <li key={e.id} className="relative text-sm">
                    <span className={cn("absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full ring-2 ring-ivory-50", e.severity === "critical" ? "bg-oxblood-600" : e.severity === "warning" ? "bg-ochre-600" : "bg-midnight-600")} aria-hidden />
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <code className="font-mono text-[0.8rem] text-midnight-900" dir="ltr">
                        {e.type}
                      </code>
                      <span className="text-xs text-charcoal-500 tabular">{formatDateTime(e.occurredAt, locale, undefined, { dateStyle: "short", timeStyle: "medium" })}</span>
                    </div>
                    {e.data && Object.keys(e.data).length > 0 && (
                      <p className="mt-0.5 truncate font-mono text-[0.7rem] text-charcoal-500" dir="ltr">
                        {Object.entries(e.data)
                          .filter(([, v]) => v !== undefined && v !== null)
                          .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                          .join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title={t("detail.paperTitle")}>
            {d.paper && roll ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-4xl text-midnight-900 tabular">{Math.round(d.paper.remainingPct)}%</span>
                    <span className="text-xs text-charcoal-500">{t("detail.paperRemaining", { mm: formatNumber(d.paper.remainingMm / 1000, locale, { maximumFractionDigits: 1 }), total: formatNumber(d.paper.totalMm / 1000, locale, { maximumFractionDigits: 1 }) })}</span>
                  </div>
                  <div className="mt-2">
                    <Meter value={d.paper.remainingPct} label={t("detail.paperTitle")} />
                  </div>
                  <p className="mt-2 text-xs text-charcoal-500">{t("detail.paperUncertainty", { unc: d.paper.uncertaintyPct, confidence: t(`detail.confidence.${d.paper.confidence}` as "detail.confidence.low") })}</p>
                </div>
                <Dl
                  items={[
                    [t("detail.daysToEmpty"), d.paper.daysToEmpty !== null ? formatNumber(d.paper.daysToEmpty, locale, { maximumFractionDigits: 1 }) : <span className="text-charcoal-500">{t("detail.daysUnknown")}</span>],
                    [t("detail.nearEnd"), <SensorBadge key="ne" value={d.tele.capabilities?.nearEnd === "unsupported" ? "unsupported" : d.tele.paperSensor} t={tt} />],
                    [t("detail.installed"), formatDate(roll.installedAt, locale)],
                  ]}
                />
                {s.permissions.has("maintenance.manage") && !revoked && <RollChangeForm deviceId={dev.id} />}
                {d.rolls.length > 1 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-charcoal-600">{t("detail.rollHistory")}</summary>
                    <ul className="mt-2 space-y-1 text-xs text-charcoal-500">
                      {d.rolls
                        .filter((r) => r.removedAt)
                        .map((r) => (
                          <li key={r.id} className="tabular">
                            {t("detail.until", { from: formatDate(r.installedAt, locale), to: formatDate(r.removedAt!, locale) })} · {t("detail.rollUsed", { m: formatNumber(r.usedMm / 1000, locale, { maximumFractionDigits: 1 }) })}
                          </li>
                        ))}
                    </ul>
                  </details>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-charcoal-500">{t("detail.noRoll")}</p>
                {s.permissions.has("maintenance.manage") && !revoked && <RollChangeForm deviceId={dev.id} />}
              </div>
            )}
          </Panel>

          <Panel title={t("detail.commandsTitle")} action={<span className="text-xs text-charcoal-500">{t("detail.commandsHint")}</span>}>
            {s.permissions.has("devices.command") && <CommandButtons deviceId={dev.id} paused={dev.paused} disabled={revoked} />}
            {d.commands.length === 0 ? (
              <p className="mt-4 text-sm text-charcoal-500">{t("detail.noCommands")}</p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--line)] text-sm">
                {d.commands.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{t(`detail.cmd.${c.type}` as "detail.cmd.pause")}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={c.status === "succeeded" ? "success" : c.status === "failed" || c.status === "expired" ? "danger" : "neutral"}>{t(`detail.cmdStatus.${c.status}` as "detail.cmdStatus.pending")}</Badge>
                      <span className="text-xs text-charcoal-500">{relativeTime(c.createdAt, locale)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title={t("detail.assignTitle")}>
            <p className="mb-4 text-xs text-charcoal-500">{t("detail.assignHint")}</p>
            <Dl items={[[t("detail.currentGrave"), currentAssign?.graveName ? <bdi key="g">{currentAssign.graveName}</bdi> : <span className="text-charcoal-500">{t("list.unassigned")}</span>]]} />
            {s.permissions.has("devices.provision") && !revoked && (
              <div className="mt-5">
                <AssignmentForm deviceId={dev.id} graves={graves.map((g) => ({ id: g.id, name: g.name }))} currentGraveId={currentAssign?.graveId ?? null} />
              </div>
            )}
            {d.assigns.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">{t("detail.assignHistory")}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {d.assigns.map((a) => (
                    <li key={a.id} className="flex flex-wrap justify-between gap-2">
                      <bdi>{a.graveName ?? "—"}</bdi>
                      <span className="text-xs text-charcoal-500 tabular">{a.unassignedAt ? t("detail.until", { from: formatDate(a.assignedAt, locale), to: formatDate(a.unassignedAt, locale) }) : t("detail.since", { when: formatDate(a.assignedAt, locale) })}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title={t("detail.credsTitle")}>
            <p className="mb-3 text-xs text-charcoal-500">{t("detail.credsHint")}</p>
            <ul className="space-y-2 text-sm">
              {d.creds.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                  <code className="font-mono text-xs" dir="ltr">
                    {c.tokenPrefix}…
                  </code>
                  <span className="text-xs text-charcoal-500">
                    {c.revokedAt && c.revokedAt < new Date() ? t("detail.tokenRevoked", { when: relativeTime(c.revokedAt, locale) }) : t("detail.tokenActive")}
                    {c.lastUsedAt ? ` · ${t("detail.tokenLastUsed", { when: relativeTime(c.lastUsedAt, locale) })}` : ""}
                  </span>
                </li>
              ))}
            </ul>
            {s.permissions.has("devices.provision") && (
              <div className="mt-5">
                <RevokeButton deviceId={dev.id} disabled={revoked} />
              </div>
            )}
          </Panel>

          <Panel title={t("detail.serial")}>
            <Dl
              items={[
                [t("detail.serial"), <code key="s" className="font-mono text-xs" dir="ltr">{dev.serial}</code>],
                [t("detail.profile"), dev.printerProfileId ?? "—"],
                [t("detail.agent"), <span key="a" dir="ltr">{dev.agentVersion ?? "—"}</span>],
                [t("detail.network"), d.tele.network ?? t("sensor.unknown")],
                [t("detail.uptime"), typeof d.tele.uptimeS === "number" ? `${formatNumber(d.tele.uptimeS / 3600, locale, { maximumFractionDigits: 1 })} h` : t("sensor.unknown")],
                [t("detail.temp"), typeof d.tele.tempC === "number" ? `${d.tele.tempC} °C` : t("sensor.unsupported")],
                [t("list.colPower"), <PowerBadge key="p" tele={d.tele} t={tt} />],
                [t("list.colSensors"), (
                  <span key="se" className="flex flex-wrap gap-1">
                    <SensorBadge label={t("list.sensorCover")} value={d.tele.cover} t={tt} />
                    <SensorBadge label={t("list.sensorCutter")} value={d.tele.cutter} t={tt} />
                    <SensorBadge label={t("list.sensorChute")} value={d.tele.chuteSensor} t={tt} />
                  </span>
                )],
              ]}
            />
            {d.tele.capabilities?.power !== "supported" && <p className="mt-3 text-xs text-charcoal-500">{t("power.unsupportedHint")}</p>}
          </Panel>
        </div>
      </div>
    </>
  );
}
