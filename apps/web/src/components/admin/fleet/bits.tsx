/** Server-safe fleet display helpers (no hooks). */
import { Badge } from "@/components/ui";
import type { Connectivity, Tele } from "@/server/fleet-queries";

type T = (key: string, values?: Record<string, string | number>) => string;

export function connTone(c: Connectivity): "success" | "warning" | "danger" | "neutral" {
  return c === "online" ? "success" : c === "heartbeat_missed" ? "warning" : c === "offline" ? "danger" : "neutral";
}

export function ConnBadge({ c, t }: { c: Connectivity; t: T }) {
  return (
    <Badge tone={connTone(c)} dot={c === "online"}>
      {t(`conn.${c}`)}
    </Badge>
  );
}

export function SimBadge({ t }: { t: T }) {
  return (
    <span title={t("simulatedHint")} className="inline-flex items-center rounded-[3px] border border-dashed border-ochre-600/60 bg-ochre-100/70 px-1.5 py-px font-mono text-[0.6rem] font-semibold tracking-[0.12em] text-ochre-600">
      {t("simulated")}
    </span>
  );
}

const SENSOR_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  ok: "success",
  closed: "success",
  near_end: "warning",
  blocked: "warning",
  paper_end: "danger",
  open: "danger",
  fault: "danger",
};

export function SensorBadge({ label, value, t }: { label?: string; value: string | undefined; t: T }) {
  const v = value ?? "unknown";
  return (
    <Badge tone={SENSOR_TONE[v] ?? "neutral"}>
      {label ? `${label}: ` : ""}
      {t(`sensor.${v}`)}
    </Badge>
  );
}

/** Power claims follow the capability: "AC lost" only when hardware can actually tell. */
export function PowerBadge({ tele, t }: { tele: Tele; t: T }) {
  const cap = tele.capabilities?.power;
  if (cap !== "supported") return <Badge tone="neutral">{t("power.unsupported")}</Badge>;
  const p = tele.power ?? "unknown";
  return (
    <Badge tone={p === "ac" ? "success" : p === "battery" ? "warning" : "neutral"}>
      {t(`power.${p}`)}
      {p === "battery" && typeof tele.batteryPct === "number" ? ` · ${tele.batteryPct}%` : ""}
    </Badge>
  );
}
