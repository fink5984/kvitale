import { getTranslations, setRequestLocale } from "next-intl/server";
import { SimBadge } from "@/components/admin/fleet/bits";
import { AlertActions, NewTicket, TicketControls } from "@/components/admin/fleet/FleetClient";
import { PageHeader, Panel, Table, Td } from "@/components/admin/kit";
import { Badge, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn, formatDateTime, relativeTime } from "@/lib/format";
import { guardPage } from "@/server/admin-guard";
import { assignableUsers, listAlerts, listFleet, listTickets } from "@/server/fleet-queries";

export const dynamic = "force-dynamic";

const ALERT_FILTERS = ["active", "open", "acknowledged", "resolved", "all"] as const;
type AlertFilter = (typeof ALERT_FILTERS)[number];

export default async function AlertsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string; status?: string; closed?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await guardPage(locale, "maintenance.manage", "/admin/alerts");
  const t = await getTranslations("admin.fleet");
  const tt = t as unknown as (k: string, v?: Record<string, string | number>) => string;
  const sp = await searchParams;
  const tab = sp.tab === "tickets" ? "tickets" : "alerts";
  const status: AlertFilter = (ALERT_FILTERS as readonly string[]).includes(sp.status ?? "") ? (sp.status as AlertFilter) : "active";
  const showClosed = sp.closed === "1";
  const [fleet, assignees] = await Promise.all([listFleet(locale, s.graveScope), assignableUsers()]);
  const devices = fleet.map((d) => ({ id: d.id, name: d.name }));
  const filterLabel: Record<AlertFilter, string> = { active: t("alerts.filterActive"), open: t("alerts.filterOpen"), acknowledged: t("alerts.filterAck"), resolved: t("alerts.filterResolved"), all: t("alerts.filterAll") };

  return (
    <>
      <PageHeader eyebrow={t("eyebrow")} title={t("alerts.title")} description={t("alerts.description")} actions={<NewTicket devices={devices} assignees={assignees} />} />
      <div role="tablist" aria-label={t("alerts.title")} className="mb-5 inline-flex rounded-full border border-[var(--line-strong)] bg-ivory-50 p-1">
        {(["alerts", "tickets"] as const).map((k) => (
          <Link key={k} role="tab" aria-selected={tab === k} href={k === "alerts" ? "/admin/alerts" : "/admin/alerts?tab=tickets"} className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", tab === k ? "bg-midnight-900 text-ivory-50" : "text-charcoal-600 hover:text-midnight-900")}>
            {k === "alerts" ? t("alerts.tabAlerts") : t("alerts.tabTickets")}
          </Link>
        ))}
      </div>

      {tab === "alerts" ? (
        <AlertsTab locale={locale} scope={s.graveScope} status={status} filterLabel={filterLabel} devices={devices} assignees={assignees} t={tt} />
      ) : (
        <TicketsTab locale={locale} scope={s.graveScope} showClosed={showClosed} assignees={assignees} t={tt} />
      )}
    </>
  );
}

async function AlertsTab({ locale, scope, status, filterLabel, devices, assignees, t }: { locale: string; scope: string[] | null; status: AlertFilter; filterLabel: Record<AlertFilter, string>; devices: Array<{ id: string; name: string }>; assignees: Array<{ id: string; label: string }>; t: (k: string, v?: Record<string, string | number>) => string }) {
  const rows = await listAlerts(locale, scope, status);
  return (
    <>
      <nav aria-label={t("alerts.tabAlerts")} className="mb-4 flex flex-wrap gap-1.5">
        {ALERT_FILTERS.map((k) => (
          <Link key={k} href={k === "active" ? "/admin/alerts" : `/admin/alerts?status=${k}`} aria-current={status === k ? "page" : undefined} className={cn("rounded-full px-3.5 py-1.5 text-sm", status === k ? "bg-midnight-900 text-ivory-50" : "bg-stone-100 text-charcoal-700 hover:bg-stone-200")}>
            {filterLabel[k]}
          </Link>
        ))}
      </nav>
      <Panel padded={false}>
        <Table head={[t("alerts.colAlert"), t("alerts.colUnit"), t("alerts.colOpened"), t("alerts.colState"), ""]} caption={t("alerts.tabAlerts")}>
          {rows.map((a) => (
            <tr key={a.id} className="align-top">
              <Td>
                <span className="flex flex-wrap items-center gap-2">
                  <Badge tone={a.severity === "critical" ? "danger" : a.severity === "warning" ? "warning" : "info"}>{t(`alerts.severity.${a.severity}`)}</Badge>
                  <span className="font-medium text-midnight-900">{t(`alerts.kind.${a.kind}`)}</span>
                </span>
                {a.kind === "device_offline" || a.kind === "heartbeat_missed" ? <p className="mt-1 max-w-sm text-xs text-charcoal-500">{t("alerts.offlineNote")}</p> : null}
                {a.data && typeof (a.data as Record<string, unknown>).remainingPct === "number" && (
                  <p className="mt-1 text-xs text-charcoal-500 tabular" dir="ltr">
                    {String((a.data as Record<string, unknown>).remainingPct)}% · {String((a.data as Record<string, unknown>).daysToEmpty ?? "—")} d
                  </p>
                )}
              </Td>
              <Td>
                {a.deviceId ? (
                  <Link href={`/admin/devices/${a.deviceId}`} className="underline-offset-4 hover:underline">
                    {a.deviceName}
                  </Link>
                ) : (
                  "—"
                )}
                {a.simulated && <span className="ms-2"><SimBadge t={t} /></span>}
                {a.graveName && (
                  <p className="text-xs text-charcoal-500">
                    <bdi>{a.graveName}</bdi>
                  </p>
                )}
              </Td>
              <Td className="whitespace-nowrap text-xs text-charcoal-600">
                <span title={formatDateTime(a.openedAt, locale)}>{relativeTime(a.openedAt, locale)}</span>
              </Td>
              <Td>
                <Badge tone={a.status === "open" ? "danger" : a.status === "acknowledged" ? "warning" : "success"}>{t(`alerts.state.${a.status}`)}</Badge>
              </Td>
              <Td className="text-end">
                <div className="flex flex-wrap justify-end gap-1.5">
                  <AlertActions id={a.id} status={a.status} />
                  {a.status !== "resolved" && (
                    <NewTicket
                      devices={devices}
                      assignees={assignees}
                      alertId={a.id}
                      defaultDeviceId={a.deviceId ?? undefined}
                      defaultTitle={t(`alerts.kind.${a.kind}`)}
                      trigger={<button type="button" className={buttonClass("ghost", "sm")}>{t("alerts.toTicket")}</button>}
                    />
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </Table>
        {rows.length === 0 && <p className="px-5 py-10 text-center text-sm text-charcoal-500">{t("alerts.noAlerts")}</p>}
      </Panel>
    </>
  );
}

async function TicketsTab({ locale, scope, showClosed, assignees, t }: { locale: string; scope: string[] | null; showClosed: boolean; assignees: Array<{ id: string; label: string }>; t: (k: string, v?: Record<string, string | number>) => string }) {
  const rows = await listTickets(locale, scope, !showClosed);
  return (
    <>
      <div className="mb-4">
        <Link href={showClosed ? "/admin/alerts?tab=tickets" : "/admin/alerts?tab=tickets&closed=1"} className="text-sm text-charcoal-600 underline underline-offset-4">
          {showClosed ? t("alerts.hideClosed") : t("alerts.showClosed")}
        </Link>
      </div>
      {rows.length === 0 ? (
        <Panel>
          <p className="py-6 text-center text-sm text-charcoal-500">{t("alerts.noTickets")}</p>
        </Panel>
      ) : (
        <ul className="space-y-4">
          {rows.map((tk) => (
            <li key={tk.id}>
              <Panel className={cn(tk.overdue && "border-oxblood-600/40")}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tk.priority === 1 ? "danger" : tk.priority === 2 ? "gold" : "neutral"}>{t(`alerts.priorities.${tk.priority}`)}</Badge>
                      <Badge tone="info">{t(`alerts.ticketKinds.${tk.kind}`)}</Badge>
                      {tk.overdue && <Badge tone="danger">{t("alerts.overdue")}</Badge>}
                    </div>
                    <h3 className="mt-2 font-display text-xl text-midnight-900">{tk.title}</h3>
                    <p className="mt-1 text-sm text-charcoal-500">
                      {tk.deviceId ? (
                        <Link href={`/admin/devices/${tk.deviceId}`} className="underline-offset-4 hover:underline">
                          {tk.deviceName}
                        </Link>
                      ) : (
                        t("alerts.noUnit")
                      )}
                      {tk.graveName && (
                        <>
                          {" · "}
                          <bdi>{tk.graveName}</bdi>
                        </>
                      )}
                      {tk.dueAt && (
                        <>
                          {" · "}
                          <span className={cn("tabular", tk.overdue && "font-medium text-oxblood-600")}>
                            {t("alerts.colDue")}: {formatDateTime(tk.dueAt, locale)}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <TicketControls id={tk.id} status={tk.status} assigneeId={tk.assigneeUserId} assignees={assignees} />
                </div>
                {tk.logs.length > 0 && (
                  <details className="mt-4 border-t border-[var(--line)] pt-3">
                    <summary className="cursor-pointer text-sm text-charcoal-600">{t("alerts.notes", { count: tk.logs.length })}</summary>
                    <ul className="mt-3 space-y-3">
                      {tk.logs.map((l) => (
                        <li key={l.id} className="text-sm">
                          <p className="text-xs text-charcoal-500">
                            {l.author ?? "—"} · {formatDateTime(l.createdAt, locale)}
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap text-charcoal-800" dir="auto">
                            {l.note}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
