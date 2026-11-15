/**
 * Admin kit — server-safe presentational components shared by all modules.
 * Charts are hand-built SVG: no random numbers, values come from queries only.
 */
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/format";

export function PageHeader({ eyebrow, title, description, actions, crumbs }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; crumbs?: Array<{ href?: string; label: string }> }) {
  return (
    <div className="mb-8 flex flex-col gap-4 border-b border-[var(--line)] pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {crumbs && (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-charcoal-500">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {c.href ? (
                  <Link href={c.href} className="hover:text-midnight-900">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page">{c.label}</span>
                )}
                {i < crumbs.length - 1 && <span aria-hidden>/</span>}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && <p className="eyebrow text-gold-700">{eyebrow}</p>}
        <h1 className="font-display mt-1 text-[2.1rem] leading-tight text-midnight-900 sm:text-[2.5rem]">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-charcoal-600">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className, padded = true, id }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; padded?: boolean; id?: string }) {
  return (
    <section id={id} className={cn("min-w-0 rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-soft", className)}>
      {title && (
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3.5">
          <h2 className="text-[0.95rem] font-semibold text-midnight-900">{title}</h2>
          {action}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, delta, href, tone = "default", demo }: { label: string; value: ReactNode; sub?: ReactNode; delta?: { pct: number | null; good?: "up" | "down"; label?: string }; href?: string; tone?: "default" | "warning" | "danger"; demo?: boolean }) {
  const d = delta?.pct;
  const goodDir = delta?.good ?? "up";
  const positive = d !== null && d !== undefined && (goodDir === "up" ? d > 0 : d < 0);
  const negative = d !== null && d !== undefined && (goodDir === "up" ? d < 0 : d > 0);
  const inner = (
    <>
      <p className="flex items-center justify-between gap-2 text-[0.78rem] font-medium text-charcoal-500">
        {label}
        {demo && <span className="font-mono text-[0.6rem] tracking-widest text-ochre-600">DEMO</span>}
      </p>
      <p className={cn("font-display mt-2 text-[2rem] leading-none tabular", tone === "danger" ? "text-oxblood-600" : tone === "warning" ? "text-ochre-600" : "text-midnight-900")}>{value}</p>
      <div className="mt-3 flex items-center gap-2 text-xs">
        {delta && (
          <span dir="ltr" className={cn("inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium tabular", positive && "bg-sage-100 text-sage-600", negative && "bg-oxblood-100 text-oxblood-600", !positive && !negative && "bg-stone-100 text-charcoal-600")}>
            {d === null || d === undefined ? <Minus className="size-3" /> : d > 0 ? <ArrowUpRight className="size-3" /> : d < 0 ? <ArrowDownRight className="size-3" /> : <Minus className="size-3" />}
            {d === null || d === undefined ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(0)}%`}
          </span>
        )}
        {sub && <span className="truncate text-charcoal-500">{sub}</span>}
      </div>
    </>
  );
  const cls = "block rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft transition-colors";
  return href ? (
    <Link href={href} className={cn(cls, "hover:border-gold-400")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Table({ head, children, empty, caption }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode; caption?: string }) {
  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-[40rem] text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="bg-ivory-200/60 text-start text-[0.72rem] uppercase tracking-wider text-charcoal-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-4 py-2.5 text-start font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--line)]">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export const Td = ({ children, className }: { children?: ReactNode; className?: string }) => <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;

/** Bars per day — values are real counts from the DB. */
export function BarChart({ data, label, height = 140, format = (v: number) => String(v) }: { data: Array<{ x: string; y: number; y2?: number }>; label: string; height?: number; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.y, d.y2 ?? 0)));
  const w = 100 / Math.max(1, data.length);
  return (
    <figure>
      <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label={label} direction="ltr">
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2="100" y1={(height / 4) * g} y2={(height / 4) * g} stroke="var(--color-stone-300)" strokeWidth=".1" />
        ))}
        {data.map((d, i) => {
          const h = (d.y / max) * (height / 4 - 2);
          const h2 = d.y2 !== undefined ? (d.y2 / max) * (height / 4 - 2) : 0;
          return (
            <g key={d.x}>
              <title>{`${d.x}: ${format(d.y)}${d.y2 !== undefined ? ` / ${format(d.y2)}` : ""}`}</title>
              <rect x={i * w + w * 0.12} y={height / 4 - h} width={d.y2 !== undefined ? w * 0.36 : w * 0.76} height={h} fill="var(--color-midnight-700)" rx=".3" />
              {d.y2 !== undefined && <rect x={i * w + w * 0.52} y={height / 4 - h2} width={w * 0.36} height={h2} fill="var(--color-gold-400)" rx=".3" />}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex justify-between text-[0.68rem] text-charcoal-500 tabular" dir="ltr">
        <span>{data[0]?.x}</span>
        <span>{data[data.length - 1]?.x}</span>
      </figcaption>
    </figure>
  );
}

export function LineChart({ series, label, unit, min, max: maxIn }: { series: Array<{ x: number; y: number | null }>; label: string; unit?: string; min?: number; max?: number }) {
  const pts = series.filter((p) => p.y !== null) as Array<{ x: number; y: number }>;
  if (pts.length < 2) return <p className="py-8 text-center text-sm text-charcoal-500">—</p>;
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const lo = min ?? Math.min(...ys);
  const hi = maxIn ?? Math.max(...ys);
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const sx = (x: number) => ((x - x0) / Math.max(1, x1 - x0)) * 100;
  const sy = (y: number) => 30 - ((y - lo) / Math.max(1e-9, hi - lo)) * 28 - 1;
  const d = pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(" ");
  return (
    <figure>
      <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-28 w-full" role="img" aria-label={label}>
        <path d={`${d} L100,30 L0,30 Z`} fill="var(--color-gold-300)" opacity=".18" />
        <path d={d} fill="none" stroke="var(--color-midnight-700)" strokeWidth=".6" vectorEffect="non-scaling-stroke" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[0.68rem] text-charcoal-500 tabular" dir="ltr">
        <span>
          {lo.toFixed(0)}
          {unit}
        </span>
        <span>
          {hi.toFixed(0)}
          {unit}
        </span>
      </figcaption>
    </figure>
  );
}

export function Meter({ value, label, tone }: { value: number; label: string; tone?: "ok" | "warn" | "bad" }) {
  const v = Math.max(0, Math.min(100, value));
  const tt = tone ?? (v < 15 ? "bad" : v < 35 ? "warn" : "ok");
  return (
    <div role="meter" aria-label={label} aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
        <div className={cn("h-full rounded-full", tt === "ok" && "bg-sage-600", tt === "warn" && "bg-ochre-600", tt === "bad" && "bg-oxblood-600")} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

export function Dl({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[minmax(8rem,auto)_1fr] gap-x-4 gap-y-2.5 text-sm">
      {items.map(([k, v], i) => (
        <div key={i} className="contents">
          <dt className="text-charcoal-500">{k}</dt>
          <dd className="min-w-0 break-words text-midnight-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function pctDelta(cur: number, prev: number): number | null {
  if (!prev) return cur ? null : 0;
  return ((cur - prev) / prev) * 100;
}

export const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info" | "gold"> = {
  fulfilled: "success",
  paid: "gold",
  in_fulfillment: "info",
  attention: "danger",
  refunded: "neutral",
  partially_refunded: "warning",
  pending_payment: "neutral",
  payment_failed: "danger",
  canceled: "neutral",
};
