"use client";

import { Pause, Play, StepForward, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { SimulatedDevice, type PrintedSlip, type SimKnobs } from "@kvittel/device-sim";
import { fromBase64, unpackToRgba } from "@kvittel/print-layout";
import { Panel } from "@/components/admin/kit";
import { Badge, Button, DemoBadge, EmptyState, Notice, Segmented, Select, Skeleton, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/format";

interface SimDev {
  deviceId: string;
  serial: string;
  token: string;
  grave: string;
  name: string;
  commandKey: string;
}

type BoolKnob = "online" | "acPower" | "cutterJam" | "chuteSensorFail" | "doubleCallback" | "rebootMidPrint" | "dropAckOnce";

/** Toggles where "on" means a FAULT is injected (online/acPower are inverted for clarity). */
const FAULTS: Array<{ key: BoolKnob; invert?: boolean }> = [
  { key: "online", invert: true },
  { key: "acPower", invert: true },
  { key: "cutterJam" },
  { key: "chuteSensorFail" },
  { key: "doubleCallback" },
  { key: "rebootMidPrint" },
  { key: "dropAckOnce" },
];

export function DeviceLab() {
  const t = useTranslations("lab");
  const [devs, setDevs] = useState<SimDev[] | null>(null);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const simRef = useRef<SimulatedDevice | null>(null);
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/dev/sim-devices")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { devices: SimDev[] }) => {
        setDevs(d.devices);
        if (d.devices[0]) setSelected(d.devices[0].deviceId);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    simRef.current?.stop();
    const d = devs?.find((x) => x.deviceId === selected);
    if (!d) {
      simRef.current = null;
      return;
    }
    simRef.current = new SimulatedDevice({ server: window.location.origin, token: d.token, deviceId: d.deviceId, commandKey: d.commandKey, onChange: rerender });
    rerender();
    return () => simRef.current?.stop();
  }, [selected, devs]);

  const sim = simRef.current;
  const tickOnce = useCallback(async () => {
    if (!simRef.current) return;
    setBusy(true);
    try {
      await simRef.current.tick();
    } finally {
      setBusy(false);
      rerender();
    }
  }, []);

  if (error) return <Notice tone="warning">{t("loadError")}</Notice>;
  if (!devs) return <Skeleton className="h-96" />;
  if (!devs.length) return <EmptyState title={t("none.title")} body={t("none.body")} />;

  const setKnob = <K extends keyof SimKnobs>(k: K, v: SimKnobs[K]) => {
    if (!sim) return;
    sim.knobs[k] = v;
    rerender();
  };

  return (
    <div className="space-y-6">
      <Notice tone="warning" title={t("disclaimer.title")}>
        {t("disclaimer.body")}
      </Notice>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-charcoal-800">
          {t("unit")}
          <Select value={selected} onChange={(e) => setSelected(e.target.value)} className="min-w-64" data-testid="lab-unit">
            {devs.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.name} · {d.serial}
              </option>
            ))}
          </Select>
        </label>
        {sim && (
          <>
            {sim.running ? (
              <Button variant="outline" icon={<Pause className="size-4" />} onClick={() => { sim.stop(); rerender(); }}>
                {t("stop")}
              </Button>
            ) : (
              <Button icon={<Play className="size-4" />} onClick={() => { sim.start(3000); rerender(); }}>
                {t("start")}
              </Button>
            )}
            <Button variant="quiet" icon={<StepForward className="size-4" />} loading={busy} onClick={tickOnce} data-testid="lab-tick">
              {t("tick")}
            </Button>
          </>
        )}
        <Link href="/write" className={buttonClass("ghost", "md")}>
          {t("writeOrder")}
        </Link>
      </div>

      {sim && (
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            <Panel title={t("state.title")} action={<DemoBadge label={t("simBadge")} />}>
              <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <State label={t("state.loop")} value={sim.running ? t("state.running") : t("state.stopped")} tone={sim.running ? "success" : "neutral"} />
                <State label={t("state.phase")} value={t(`phase.${sim.phase}`)} tone={sim.phase === "offline" ? "danger" : sim.phase === "idle" ? "neutral" : "gold"} testId="lab-phase" />
                <State label={t("state.heartbeat")} value={sim.lastHeartbeatOk === null ? "—" : sim.lastHeartbeatOk ? t("state.ok") : t("state.failed")} tone={sim.lastHeartbeatOk === false ? "danger" : sim.lastHeartbeatOk ? "success" : "neutral"} testId="lab-heartbeat" />
                <State label={t("state.paused")} value={sim.paused ? t("yes") : t("no")} tone={sim.paused ? "warning" : "neutral"} />
                <State label={t("state.outbox")} value={String(sim.outbox.length)} tone={sim.outbox.length ? "warning" : "neutral"} />
                <State label={t("state.journal")} value={String(sim.journal.size)} tone="neutral" />
              </dl>
            </Panel>

            <Panel title={t("knobs.title")}>
              <p className="mb-4 text-sm text-charcoal-600">{t("knobs.hint")}</p>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-charcoal-800">{t("knobs.paper")}</span>
                <Segmented label={t("knobs.paper")} size="sm" value={sim.knobs.paper} onChange={(v) => setKnob("paper", v)} options={(["ok", "near_end", "paper_end"] as const).map((p) => ({ value: p, label: t(`paper.${p}`) }))} />
                <span className="ms-2 text-sm font-medium text-charcoal-800">{t("knobs.cover")}</span>
                <Segmented label={t("knobs.cover")} size="sm" value={sim.knobs.cover} onChange={(v) => setKnob("cover", v)} options={(["closed", "open"] as const).map((p) => ({ value: p, label: t(`cover.${p}`) }))} />
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {FAULTS.map(({ key, invert }) => {
                  const fault = invert ? !sim.knobs[key] : !!sim.knobs[key];
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={fault}
                        data-testid={`knob-${key}`}
                        onClick={() => setKnob(key, (invert ? fault : !fault) as never)}
                        className={cn("flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-3 text-start text-sm transition-colors", fault ? "border-oxblood-600/40 bg-oxblood-100/60" : "border-[var(--line)] bg-ivory-50 hover:border-stone-400")}
                      >
                        <span>
                          <span className="block font-medium text-midnight-900">{t(`knobs.${key}`)}</span>
                          <span className="block text-xs text-charcoal-500">{t(`knobs.${key}Hint`)}</span>
                        </span>
                        <span className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", fault ? "bg-oxblood-600" : "bg-stone-300")} aria-hidden>
                          <span className={cn("absolute top-0.5 size-5 rounded-full bg-ivory-50 shadow transition-all", fault ? "start-[1.375rem]" : "start-0.5")} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>

            <Panel title={t("log.title")} padded={false}>
              <ol className="scroll-thin max-h-80 overflow-y-auto px-5 py-3 font-mono text-[0.75rem] leading-relaxed" dir="ltr" aria-live="polite" data-testid="lab-log">
                {sim.log.length === 0 && <li className="text-charcoal-500">{t("log.empty")}</li>}
                {sim.log.map((e, i) => (
                  <li key={`${e.at}-${i}`} className={cn("border-b border-[var(--line)] py-1", e.level === "error" && "text-oxblood-600", e.level === "warn" && "text-ochre-600", e.level === "info" && "text-charcoal-700")}>
                    <span className="text-charcoal-400">{e.at.slice(11, 19)}</span> {e.msg}
                  </li>
                ))}
              </ol>
            </Panel>
          </div>

          <PrinterMouth slips={sim.printed} onClear={() => { sim.printed = []; rerender(); }} />
        </div>
      )}
    </div>
  );
}

function State({ label, value, tone, testId }: { label: string; value: string; tone: "success" | "danger" | "warning" | "neutral" | "gold"; testId?: string }) {
  return (
    <div>
      <dt className="text-xs text-charcoal-500">{label}</dt>
      <dd className="mt-1" data-testid={testId}>
        <Badge tone={tone}>{value}</Badge>
      </dd>
    </div>
  );
}

function PrinterMouth({ slips, onClear }: { slips: PrintedSlip[]; onClear: () => void }) {
  const t = useTranslations("lab.printer");
  return (
    <section className="tex-night relative overflow-hidden rounded-t-[10rem] rounded-b-xl p-6 pt-16 text-ivory-50 shadow-lift xl:sticky xl:top-20 xl:self-start" aria-labelledby="mouth-title">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(60%_80%_at_50%_0%,rgb(207_170_99/0.18),transparent_70%)]" aria-hidden />
      <div className="relative flex flex-col items-center gap-2 pt-6 text-center">
        <h2 id="mouth-title" className="eyebrow text-gold-300">
          {t("title")}
        </h2>
        {slips.length > 0 && (
          <button type="button" onClick={onClear} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs text-ivory-100/60 hover:text-ivory-50">
            <Trash2 className="size-3.5" /> {t("clear")}
          </button>
        )}
      </div>
      {/* the slot */}
      <div className="relative mx-auto mt-6 h-4 w-[17rem] max-w-full rounded-full bg-midnight-950 shadow-[inset_0_2px_6px_rgb(0_0_0/0.8)] ring-1 ring-gold-400/50" aria-hidden />
      <div className="relative -mt-2 flex max-h-[38rem] flex-col items-center gap-5 overflow-y-auto px-2 pb-4 pt-3 scroll-thin" data-testid="lab-slips">
        {slips.length === 0 ? (
          <p className="py-16 text-center text-sm text-ivory-100/50">{t("empty")}</p>
        ) : (
          slips.map((s) => <Slip key={`${s.jobId}-${s.at}`} slip={s} />)
        )}
      </div>
      <p className="relative mt-3 text-center text-[0.7rem] text-ivory-100/45">{t("note")}</p>
    </section>
  );
}

function Slip({ slip }: { slip: PrintedSlip }) {
  const t = useTranslations("lab.printer");
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = slip.widthDots;
    c.height = slip.heightDots;
    const ctx = c.getContext("2d")!;
    const img = ctx.createImageData(slip.widthDots, slip.heightDots);
    img.data.set(unpackToRgba({ width: slip.widthDots, height: slip.heightDots, bytesPerRow: slip.bytesPerRow, data: fromBase64(slip.data) }, [28, 26, 24], [251, 249, 243]));
    ctx.putImageData(img, 0, 0);
  }, [slip]);
  return (
    <figure className="paper-feed w-[15rem] max-w-full">
      <canvas ref={ref} className="block h-auto w-full shadow-paper [image-rendering:pixelated]" style={{ aspectRatio: `${slip.widthDots} / ${slip.heightDots}` }} aria-label={t("slipAria")} />
      <figcaption className="mt-2 flex justify-between gap-2 font-mono text-[0.65rem] text-ivory-100/50" dir="ltr">
        <span>{slip.jobId.slice(0, 8)}</span>
        <span>{slip.isTest ? "TEST" : `${slip.widthDots}×${slip.heightDots}`}</span>
      </figcaption>
    </figure>
  );
}
