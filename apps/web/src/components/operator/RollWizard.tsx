"use client";

import { Camera, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { rollLengthMm } from "@kvittel/print-layout";
import { changeRoll } from "@/app/actions/operator";
import { Button, Checkbox, Field, Input, Notice, Stepper, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { TestPrintButton } from "./UnitActions";

const CHECKS = ["door", "remove", "load", "cover"] as const;

export function RollWizard({ deviceId, canTest }: { deviceId: string; canTest: boolean }) {
  const t = useTranslations("operator.roll");
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [outer, setOuter] = useState("40");
  const [core, setCore] = useState("12");
  const [thickness, setThickness] = useState("0.06");
  const [nominal, setNominal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const o = Number(outer);
  const c = Number(core);
  const th = Number(thickness);
  const valid = o >= 20 && o <= 90 && c >= 5 && c < o && th >= 0.03 && th <= 0.15;
  const est = valid ? rollLengthMm({ outerDiameterMm: o, coreDiameterMm: c, paperThicknessMm: th }) : 0;

  return (
    <div className="space-y-6">
      <Stepper steps={[t("steps.prepare"), t("steps.specs"), t("steps.confirm")]} current={step} label={t("steps.label")} />

      {step === 0 && (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft sm:p-6">
          <h2 className="font-display text-2xl text-midnight-900">{t("prepare.title")}</h2>
          <p className="mt-1 text-sm text-charcoal-600">{t("prepare.body")}</p>
          <ul className="mt-5 space-y-4">
            {CHECKS.map((k, i) => (
              <li key={k}>
                <Checkbox checked={!!done[k]} onChange={(e) => setDone((d) => ({ ...d, [k]: e.target.checked }))} label={`${i + 1}. ${t(`prepare.${k}`)}`} description={t(`prepare.${k}Hint`)} />
              </li>
            ))}
          </ul>
          <div className="mt-5 flex items-center gap-2 rounded-md border border-dashed border-stone-300 bg-ivory-50 px-4 py-3 text-sm text-charcoal-500">
            <Camera className="size-4 shrink-0" aria-hidden /> {t("photoLater")}
          </div>
          <div className="mt-6 flex justify-end">
            <Button type="button" disabled={!CHECKS.every((k) => done[k])} onClick={() => setStep(1)}>
              {t("next")}
            </Button>
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft sm:p-6">
          <h2 className="font-display text-2xl text-midnight-900">{t("specs.title")}</h2>
          <p className="mt-1 text-sm text-charcoal-600">{t("specs.body")}</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <Field label={t("specs.outer")} htmlFor="r-outer" hint="mm">
              <Input id="r-outer" inputMode="decimal" dir="ltr" value={outer} onChange={(e) => setOuter(e.target.value)} />
            </Field>
            <Field label={t("specs.core")} htmlFor="r-core" hint="mm">
              <Input id="r-core" inputMode="decimal" dir="ltr" value={core} onChange={(e) => setCore(e.target.value)} />
            </Field>
            <Field label={t("specs.thickness")} htmlFor="r-th" hint="mm">
              <Input id="r-th" inputMode="decimal" dir="ltr" value={thickness} onChange={(e) => setThickness(e.target.value)} />
            </Field>
          </div>
          <Field label={t("specs.nominal")} htmlFor="r-nom" optional={t("optional")} hint={t("specs.nominalHint")} className="mt-4">
            <Input id="r-nom" inputMode="numeric" dir="ltr" value={nominal} onChange={(e) => setNominal(e.target.value.replace(/\D/g, ""))} />
          </Field>
          {valid ? (
            <p className="mt-4 text-sm text-charcoal-700">{t("specs.estimate", { m: (est / 1000).toFixed(1) })}</p>
          ) : (
            <Notice tone="warning" className="mt-4">
              {t("specs.invalid")}
            </Notice>
          )}
          <div className="mt-6 flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              {t("back")}
            </Button>
            <Button type="button" disabled={!valid} onClick={() => setStep(2)}>
              {t("next")}
            </Button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft sm:p-6">
          <h2 className="font-display text-2xl text-midnight-900">{t("confirm.title")}</h2>
          <p className="mt-1 text-sm text-charcoal-600">{t("confirm.body")}</p>
          <dl className="mt-5 grid grid-cols-2 gap-2 text-sm tabular" dir="ltr">
            <dt className="text-charcoal-500">Ø</dt>
            <dd>
              {outer} / {core} mm
            </dd>
            <dt className="text-charcoal-500">t</dt>
            <dd>{thickness} mm</dd>
            <dt className="text-charcoal-500">≈</dt>
            <dd>{(est / 1000).toFixed(1)} m</dd>
          </dl>
          {error && (
            <Notice tone="warning" className="mt-4">
              {error}
            </Notice>
          )}
          <div className="mt-6 flex justify-between gap-2">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              {t("back")}
            </Button>
            <Button
              type="button"
              loading={pending}
              onClick={() =>
                start(async () => {
                  setError(null);
                  const r = await changeRoll({ deviceId, outer: o, core: c, thickness: th, nominalMm: nominal ? Number(nominal) : undefined });
                  if (r.ok) setStep(3);
                  else setError(t(`errors.${r.error}`));
                })
              }
            >
              {t("confirm.cta")}
            </Button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="rounded-xl border border-sage-600/30 bg-sage-100/60 p-6 text-center" role="status">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-sage-600 text-ivory-50">
            <Check className="size-6" />
          </span>
          <h2 className="font-display mt-4 text-2xl text-midnight-900">{t("success.title")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-charcoal-700">{t("success.body")}</p>
          <div className="mt-6 flex flex-wrap items-start justify-center gap-3">
            {canTest && <TestPrintButton deviceId={deviceId} />}
            <Link href="/operator" className={buttonClass("primary", "sm")}>
              {t("success.back")}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
