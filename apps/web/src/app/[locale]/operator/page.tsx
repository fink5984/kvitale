import { AlertTriangle, CircleDot, Layers, RefreshCcw, ScrollText } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Meter } from "@/components/admin/kit";
import { AutoRefresh } from "@/components/commerce/AutoRefresh";
import { TestPrintButton } from "@/components/operator/UnitActions";
import { Badge, DemoBadge, EmptyState, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn, relativeTime } from "@/lib/format";
import { requireUser } from "@/server/auth/session";
import { operatorOverview, type OperatorUnit } from "@/server/operator-queries";

export const dynamic = "force-dynamic";

const KNOWN = new Set(["ok", "near_end", "paper_end", "unknown", "unsupported", "closed", "open", "fault", "blocked", "not_installed", "ac", "battery"]);

export default async function OperatorHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await requireUser();
  const t = await getTranslations("operator.units");
  const sites = await operatorOverview(s, locale);
  const canTest = s.permissions.has("operator.test_print");

  return (
    <>
      <AutoRefresh active intervalMs={15000} />
      <div className="mb-8">
        <p className="eyebrow text-gold-700">{t("eyebrow")}</p>
        <h1 className="font-display mt-2 text-[2.1rem] leading-tight text-midnight-900 sm:text-[2.6rem]">{t("title")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-charcoal-600">{t("subtitle")}</p>
      </div>
      {sites.length === 0 ? (
        <EmptyState title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <div className="space-y-10">
          {sites.map((site) => (
            <section key={site.graveId} aria-labelledby={`site-${site.graveId}`}>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 id={`site-${site.graveId}`} className="font-display text-2xl text-midnight-900 sm:text-3xl">
                  <bdi>{site.name}</bdi>
                </h2>
                <span className="text-xs text-charcoal-500">{site.timezone}</span>
              </div>
              {site.units.length === 0 ? (
                <p className="rounded-lg border border-dashed border-stone-300 bg-ivory-50 px-4 py-6 text-sm text-charcoal-500">{t("noUnits")}</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {site.units.map((u) => (
                    <UnitCard key={u.id} u={u} locale={locale} canTest={canTest} t={t} />
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
      <p className="mt-12 text-center text-xs text-charcoal-500">{t("privacy")}</p>
    </>
  );
}

function UnitCard({ u, locale, canTest, t }: { u: OperatorUnit; locale: string; canTest: boolean; t: Awaited<ReturnType<typeof getTranslations>> }) {
  const tel = (u.telemetry ?? {}) as Record<string, unknown>;
  const caps = (tel.capabilities ?? {}) as Record<string, string>;
  const sv = (v: unknown) => {
    const k = typeof v === "string" && KNOWN.has(v) ? v : v === null || v === undefined ? "unknown" : null;
    return k ? t(`sensor.values.${k}`) : String(v);
  };
  const power = caps.power === "supported" ? sv(tel.power) : t("sensor.values.unsupported");
  const p = u.paper;
  const paperTone = !p ? "warn" : p.nearEndSensor === "near_end" || p.remainingPct < 15 ? "bad" : p.remainingPct < 35 ? "warn" : "ok";
  const rows: Array<[string, string, boolean]> = [
    [t("sensor.paper"), sv(tel.paperSensor), tel.paperSensor === "near_end" || tel.paperSensor === "paper_end"],
    [t("sensor.cover"), sv(tel.cover), tel.cover === "open"],
    [t("sensor.cutter"), sv(tel.cutter), tel.cutter === "fault"],
    [t("sensor.chute"), sv(tel.chuteSensor), tel.chuteSensor === "fault" || tel.chuteSensor === "blocked"],
    [t("sensor.power"), power, tel.power === "battery" && caps.power === "supported"],
    [t("sensor.signal"), typeof tel.signalDbm === "number" ? `${tel.signalDbm} dBm` : t("sensor.values.unknown"), false],
  ];
  return (
    <article className="flex flex-col rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-medium text-midnight-900">
            <span className={cn("size-2.5 shrink-0 rounded-full", u.online ? "bg-sage-600 shadow-[0_0_0_4px_rgb(63_93_69/0.15)]" : "bg-oxblood-600")} aria-hidden />
            <span className="truncate">{u.name}</span>
          </h3>
          <p className="mt-0.5 font-mono text-[0.7rem] text-charcoal-500" dir="ltr">
            {u.serial}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
          {u.isSimulated && <DemoBadge label={t("simulated")} />}
          <Badge tone={u.online ? "success" : "danger"}>{u.online ? t("online") : t("offline")}</Badge>
          {u.paused && <Badge tone="warning">{t("paused")}</Badge>}
        </div>
      </header>
      <p className="mt-2 text-xs text-charcoal-500">{u.lastSeenAt ? t("lastSeen", { when: relativeTime(u.lastSeenAt, locale) }) : t("neverSeen")}</p>

      <div className="mt-5 rounded-lg bg-ivory-200/50 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-midnight-900">
            <ScrollText className="size-4 text-gold-600" strokeWidth={1.5} aria-hidden /> {t("paper.title")}
          </p>
          {p ? (
            <p className="font-display text-2xl tabular text-midnight-900">
              {Math.round(p.remainingPct)}% <span className="text-sm text-charcoal-500">±{p.uncertaintyPct}</span>
            </p>
          ) : (
            <p className="text-sm text-charcoal-500">{t("paper.noRoll")}</p>
          )}
        </div>
        {p && (
          <>
            <div className="mt-3">
              <Meter value={p.remainingPct} label={t("paper.title")} tone={paperTone} />
            </div>
            <p className="mt-2 text-xs text-charcoal-600">
              {p.daysToEmpty !== null ? t("paper.days", { days: p.daysToEmpty }) : t("paper.daysUnknown")} · {t(`paper.confidence.${p.confidence}`)}
            </p>
            <p className="mt-1 text-[0.7rem] text-charcoal-500 tabular" dir="ltr">
              {(p.remainingMm / 1000).toFixed(1)} m / {(p.totalMm / 1000).toFixed(1)} m
            </p>
          </>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {rows.map(([k, v, bad]) => (
          <div key={k} className="flex items-center justify-between gap-2 border-b border-[var(--line)] pb-1.5">
            <dt className="text-charcoal-500">{k}</dt>
            <dd className={cn("text-end", bad ? "font-medium text-oxblood-600" : "text-midnight-900")}>
              <bdi dir={/^-?\d/.test(v) ? "ltr" : undefined}>{v}</bdi>
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-charcoal-600">
          <Layers className="size-4 text-gold-600" strokeWidth={1.5} aria-hidden /> {t("queue", { count: u.queueDepth })}
        </span>
      </div>

      {u.openAlerts.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {u.openAlerts.map((a) => (
            <li key={a.id} className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm", a.severity === "critical" ? "bg-oxblood-100 text-oxblood-600" : "bg-ochre-100 text-ochre-600")}>
              {a.severity === "critical" ? <AlertTriangle className="size-4 shrink-0" /> : <CircleDot className="size-4 shrink-0" />}
              <span className="flex-1">{t(`alerts.${a.kind}`)}</span>
              <span className="text-xs opacity-80">{relativeTime(a.openedAt, locale)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex flex-wrap items-start gap-2 pt-5">
        <Link href={`/operator/roll/${u.id}`} className={buttonClass("primary", "sm")}>
          <RefreshCcw className="size-4" aria-hidden /> {t("changeRoll")}
        </Link>
        {canTest && <TestPrintButton deviceId={u.id} disabled={!u.online} />}
      </div>
    </article>
  );
}
