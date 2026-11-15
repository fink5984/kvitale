"use client";

import { Eye, ImagePlus, Plus, ScanLine, Trash2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { stripUnsupported, type KvittelContent, type LayoutWarning, type NusachLanguage, type TopicId } from "@kvittel/print-layout";
import { validateKvittel } from "@/app/actions/public";
import { Badge, Button, Checkbox, DemoBadge, Drawer, Field, Input, Modal, Notice, Segmented, Stepper, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { LIMITS, type KvittelContentInput } from "@/lib/kvittel-schema";
import { cn, formatMoney, hebrewDate } from "@/lib/format";
import { emptyContent, newId, store, useStore } from "@/lib/store";
import { HandwritingUpload } from "./HandwritingUpload";
import { PaperSlips, usePreviewLayout } from "./KvittelPreview";

export interface BuilderGrave {
  slug: string;
  name: string;
  nameHe: string;
  namesByLocale: Record<string, string>;
  place: string | null;
  availability: { kind: string; reason?: string; nextOpenAt?: string | null };
  fromPrice: { amountMinor: number; currency: string } | null;
}

const TOPICS: TopicId[] = ["health", "livelihood", "marriage", "children", "success", "gratitude", "general"];
const NUSACH_MAIN: NusachLanguage[] = ["he", "yi", "en", "fr", "ru"];

export function Builder({ graves, initialSlug, flags }: { graves: BuilderGrave[]; initialSlug?: string; flags: { handwriting: boolean; multiGrave: boolean } }) {
  const t = useTranslations("builder");
  const locale = useLocale();
  const router = useRouter();
  const draft = useStore((s) => s.draft);
  const remember = useStore((s) => s.remember);
  const [hydrated, setHydrated] = useState(false);
  const [thermal, setThermal] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [serverWarnings, setServerWarnings] = useState<LayoutWarning[] | null>(null);
  const [submitting, startSubmit] = useTransition();
  const [handImages, setHandImages] = useState<Record<string, HTMLImageElement>>({});

  const bySlug = useMemo(() => Object.fromEntries(graves.map((g) => [g.slug, g])), [graves]);
  const defaultNusach: NusachLanguage = (["he", "yi", "en", "fr", "ru"] as const).includes(locale as "he") ? (locale as NusachLanguage) : "en";

  // Initialise / restore the draft (survives language switch & navigation).
  useEffect(() => {
    const s = store.get();
    if (s.draft && (!initialSlug || s.draft.graveSlugs.includes(initialSlug))) {
      // keep restored draft
    } else {
      const g = initialSlug ? bySlug[initialSlug] : undefined;
      const nusach = defaultNusach;
      store.setDraft({ graveSlugs: g ? [g.slug] : [], content: emptyContent(nusach, g ? displayNameFor(g, nusach) : ""), editingEntryId: null });
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const content = draft?.content ?? emptyContent(defaultNusach);
  const slugs = draft?.graveSlugs ?? [];
  const setContent = (patch: Partial<KvittelContentInput>) => {
    if (!draft) return;
    setServerWarnings(null);
    store.setDraft({ ...draft, content: { ...draft.content, ...patch } });
  };
  const setSlugs = (next: string[]) => {
    if (!draft) return;
    const first = next[0] ? bySlug[next[0]] : undefined;
    const prevFirst = draft.graveSlugs[0] ? bySlug[draft.graveSlugs[0]] : undefined;
    const keepName = prevFirst && draft.content.graveDisplayName !== displayNameFor(prevFirst, draft.content.nusach);
    store.setDraft({ ...draft, graveSlugs: next, content: { ...draft.content, graveDisplayName: keepName || !first ? draft.content.graveDisplayName : displayNameFor(first, draft.content.nusach) } });
  };

  const opts = useMemo(() => ({ dateLine: hebrewDate(new Date(), content.nusach === "he" || content.nusach === "yi" ? "he" : content.nusach), reference: "KV·PREVIEW" }), [content.nusach]);
  const { layout } = usePreviewLayout(content as KvittelContent, opts);
  const warnings = serverWarnings ?? layout?.warnings ?? [];
  const blocking = warnings.filter((w) => w.blocking);
  const unsupported = warnings.find((w) => w.code === "unsupported_chars");
  const pages = layout?.pages.length ?? 1;
  const unit = slugs[0] ? bySlug[slugs[0]]?.fromPrice : null;

  const step = slugs.length === 0 ? 0 : 1;
  const steps = [t("steps.choose"), t("steps.write"), t("steps.preview"), t("steps.pay"), t("steps.track")];

  const submit = () =>
    startSubmit(async () => {
      if (!draft || slugs.length === 0) {
        setPickerOpen(true);
        return;
      }
      const v = await validateKvittel(content);
      if (!v.ok) {
        setServerWarnings(v.warnings as LayoutWarning[]);
        document.getElementById("builder-warnings")?.focus();
        return;
      }
      store.addToCart({ id: draft.editingEntryId ?? newId(), graveSlugs: slugs, content });
      router.push("/cart");
    });

  if (!hydrated || !draft)
    return (
      <div className="mx-auto grid max-w-[88rem] gap-10 px-[var(--gutter)] py-16 lg:grid-cols-2">
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-40 rounded-xl" />
          ))}
        </div>
        <div className="skeleton hidden h-[36rem] rounded-xl lg:block" />
      </div>
    );

  return (
    <div className="mx-auto max-w-[88rem] px-[var(--gutter)] pb-40 pt-8 lg:pb-24">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Stepper steps={steps} current={step + 1 > 1 ? 1 : step} label={t("steps.label")} />
        <DemoBadge label={t("demoPrinter")} />
      </div>
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] xl:gap-16">
        {/* ───────────── FORM ───────────── */}
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          aria-describedby="builder-intro"
        >
          <div>
            <h1 className="font-display text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[1.02] text-midnight-900">{t("title")}</h1>
            <p id="builder-intro" className="mt-3 max-w-xl text-charcoal-600">
              {t("intro")}
            </p>
          </div>

          {/* 1. grave */}
          <Section n={1} title={t("grave.title")}>
            {slugs.length === 0 ? (
              <button type="button" onClick={() => setPickerOpen(true)} className="flex w-full items-center justify-between rounded-lg border border-dashed border-stone-400 bg-ivory-50 px-5 py-6 text-start transition-colors hover:border-gold-500 hover:bg-gold-100/30">
                <span>
                  <span className="block font-medium text-midnight-900">{t("grave.choose")}</span>
                  <span className="text-sm text-charcoal-500">{t("grave.chooseHint")}</span>
                </span>
                <Plus className="size-5 text-gold-600" />
              </button>
            ) : (
              <ul className="space-y-2">
                {slugs.map((s) => {
                  const g = bySlug[s];
                  if (!g) return null;
                  return (
                    <li key={s} className="flex items-center gap-4 rounded-lg border border-[var(--line)] bg-ivory-50 px-4 py-3">
                      <span className="tex-stone grid size-11 shrink-0 place-items-center rounded-t-full rounded-b-sm ring-1 ring-stone-300">
                        <span className="hebrew-name text-[0.7rem]" lang="he">
                          {g.nameHe.split(" ").slice(-1)[0]}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-midnight-900">
                          <bdi>{g.name}</bdi>
                        </span>
                        <span className="block truncate text-xs text-charcoal-500">{g.place}</span>
                      </span>
                      {g.availability.kind === "scheduled" && <Badge tone="warning">{t("grave.scheduled")}</Badge>}
                      <button type="button" onClick={() => setSlugs(slugs.filter((x) => x !== s))} className="grid size-8 place-items-center rounded-full text-charcoal-500 hover:bg-stone-100" aria-label={t("grave.remove", { name: g.name })}>
                        <X className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {slugs.length > 0 && flags.multiGrave && slugs.length < LIMITS.gravesPerEntry && (
              <button type="button" onClick={() => setPickerOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-midnight-900 underline-offset-4 hover:underline">
                <Plus className="size-4" /> {t("grave.addAnother")}
              </button>
            )}
            {slugs.length > 1 && <p className="mt-2 text-xs text-charcoal-500">{t("grave.multiNote")}</p>}
            <Field label={t("grave.printedName")} hint={t("grave.printedNameHint")} htmlFor="graveDisplayName" className="mt-5">
              <Input id="graveDisplayName" value={content.graveDisplayName} maxLength={LIMITS.graveNameChars} onChange={(e) => setContent({ graveDisplayName: e.target.value })} dir="auto" />
            </Field>
          </Section>

          {/* 2. language of the kvittel */}
          <Section n={2} title={t("nusach.title")} hint={t("nusach.hint")}>
            <div className="flex flex-wrap items-center gap-3">
              <Segmented
                label={t("nusach.title")}
                value={NUSACH_MAIN.includes(content.nusach) ? content.nusach : "en"}
                onChange={(v) => {
                  const g = slugs[0] ? bySlug[slugs[0]] : undefined;
                  const wasDefault = g && content.graveDisplayName === displayNameFor(g, content.nusach);
                  setContent({ nusach: v, graveDisplayName: wasDefault && g ? displayNameFor(g, v) : content.graveDisplayName });
                }}
                options={NUSACH_MAIN.map((n) => ({ value: n, label: <span lang={n}>{t(`nusach.${n}`)}</span> }))}
              />
            </div>
          </Section>

          {/* 3. names */}
          <Section n={3} title={t("people.title")} hint={t("people.hint")}>
            <ul className="space-y-3">
              {content.people.map((p, i) => (
                <li key={p.id} className="rounded-lg border border-[var(--line)] bg-ivory-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-charcoal-500">{t("people.person", { n: i + 1 })}</span>
                    <div className="flex items-center gap-2">
                      <Segmented size="sm" label={t("people.mode")} value={p.mode} onChange={(mode) => setContent({ people: content.people.map((x) => (x.id === p.id ? { ...x, mode } : x)) })} options={[{ value: "structured", label: t("people.structured") }, { value: "free", label: t("people.free") }]} />
                      {content.people.length > 1 && (
                        <button type="button" className="grid size-8 place-items-center rounded-full text-charcoal-500 hover:bg-stone-100 hover:text-oxblood-600" aria-label={t("people.remove", { n: i + 1 })} onClick={() => setContent({ people: content.people.filter((x) => x.id !== p.id) })}>
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {p.mode === "structured" ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
                      <Field label={t("people.given")} htmlFor={`g-${p.id}`}>
                        <Input id={`g-${p.id}`} dir="auto" value={p.given} maxLength={LIMITS.nameChars} placeholder={t("people.givenPh")} onChange={(e) => setContent({ people: content.people.map((x) => (x.id === p.id ? { ...x, given: e.target.value } : x)) })} />
                      </Field>
                      <div className="pb-1">
                        <Segmented size="sm" label={t("people.relation")} value={p.relation} onChange={(relation) => setContent({ people: content.people.map((x) => (x.id === p.id ? { ...x, relation } : x)) })} options={[{ value: "ben", label: t("people.ben") }, { value: "bat", label: t("people.bat") }, { value: "none", label: "—" }]} />
                      </div>
                      <Field label={t("people.parent")} htmlFor={`p-${p.id}`} optional={t("optional")}>
                        <Input id={`p-${p.id}`} dir="auto" value={p.parent ?? ""} maxLength={LIMITS.nameChars} placeholder={t("people.parentPh")} disabled={p.relation === "none"} onChange={(e) => setContent({ people: content.people.map((x) => (x.id === p.id ? { ...x, parent: e.target.value } : x)) })} />
                      </Field>
                    </div>
                  ) : (
                    <Field label={t("people.freeLabel")} htmlFor={`f-${p.id}`} hint={t("people.freeHint")}>
                      <Input id={`f-${p.id}`} dir="auto" value={p.freeText ?? ""} maxLength={LIMITS.nameChars * 2} onChange={(e) => setContent({ people: content.people.map((x) => (x.id === p.id ? { ...x, freeText: e.target.value } : x)) })} />
                    </Field>
                  )}
                </li>
              ))}
            </ul>
            {content.people.length < LIMITS.people && (
              <Button type="button" variant="quiet" size="sm" className="mt-3" icon={<Plus className="size-4" />} onClick={() => setContent({ people: [...content.people, { id: newId(), mode: "structured", given: "", parent: "", relation: "ben" }] })}>
                {t("people.add")}
              </Button>
            )}
          </Section>

          {/* 4. request */}
          <Section n={4} title={t("request.title")} hint={t("request.hint")}>
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-charcoal-800">{t("topics.title")}</legend>
              <div className="flex flex-wrap gap-2">
                {TOPICS.map((k) => {
                  const on = content.topics.includes(k);
                  return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => setContent({ topics: on ? content.topics.filter((x) => x !== k) : [...content.topics, k] })} className={cn("h-9 rounded-full border px-4 text-sm transition-all", on ? "border-midnight-900 bg-midnight-900 text-ivory-50" : "border-[var(--line-strong)] bg-ivory-50 text-charcoal-700 hover:border-stone-400")}>
                      {t(`topics.${k}`)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label={t("request.label")} htmlFor="request" className="mt-5" hint={<span className="tabular">{t("request.count", { n: content.request.length, max: LIMITS.requestChars })}</span>}>
              <Textarea id="request" dir="auto" rows={7} maxLength={LIMITS.requestChars} value={content.request} placeholder={t("request.placeholder")} onChange={(e) => setContent({ request: e.target.value })} />
            </Field>
            <div className="mt-3">
              <p className="text-xs text-charcoal-500">{t("request.suggestionsLabel")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {[0, 1, 2].map((i) => {
                  const s = t(`request.suggestions.${content.nusach === "yi" ? "he" : (["he", "en", "fr", "ru"] as const).includes(content.nusach as "he") ? content.nusach : "en"}.${i}`);
                  return (
                    <button key={i} type="button" onClick={() => setContent({ request: content.request ? `${content.request.trimEnd()}\n${s}` : s })} className="rounded-full border border-dashed border-stone-400 px-3 py-1 text-xs text-charcoal-600 hover:border-gold-500 hover:text-midnight-900" dir="auto">
                      + {s}
                    </button>
                  );
                })}
              </div>
            </div>
          </Section>

          {/* 5. handwriting */}
          {flags.handwriting && (
            <Section n={5} title={t("hand.title")} hint={t("hand.hint")} icon={<ImagePlus className="size-4" />}>
              <HandwritingUpload
                value={content.handwritingRef ? { ref: content.handwritingRef, size: content.handwritingSize! } : null}
                onChange={(v, img) => {
                  if (v && img) setHandImages((m) => ({ ...m, [v.ref]: img }));
                  setContent({ handwritingRef: v?.ref, handwritingSize: v?.size });
                }}
              />
            </Section>
          )}

          {/* 6. finishing */}
          <Section n={flags.handwriting ? 6 : 5} title={t("finish.title")}>
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-charcoal-800">{t("finish.template")}</legend>
              <div className="grid grid-cols-3 gap-3">
                {(["classic", "arch", "minimal"] as const).map((tpl) => (
                  <button key={tpl} type="button" aria-pressed={content.template === tpl} onClick={() => setContent({ template: tpl })} className={cn("flex flex-col items-center gap-2 rounded-lg border bg-ivory-50 px-2 py-4 text-sm transition-all", content.template === tpl ? "border-gold-500 shadow-glow" : "border-[var(--line)] hover:border-stone-400")}>
                    <TemplateGlyph tpl={tpl} />
                    {t(`finish.templates.${tpl}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <Field label={t("finish.signature")} htmlFor="signature" optional={t("optional")} className="mt-5" hint={t("finish.signatureHint")}>
              <Input id="signature" dir="auto" value={content.signature ?? ""} maxLength={LIMITS.signatureChars} onChange={(e) => setContent({ signature: e.target.value })} />
            </Field>
            <Checkbox className="mt-5" checked={content.showBH} onChange={(e) => setContent({ showBH: e.target.checked })} label={t("finish.bh")} />
          </Section>

          {/* privacy */}
          <div className="rounded-xl border border-[var(--line)] bg-ivory-50/70 p-5">
            <Checkbox checked={remember} onChange={(e) => store.setRemember(e.target.checked)} label={t("privacy.remember")} description={t("privacy.rememberHint")} />
            <button type="button" className="mt-4 text-sm text-oxblood-600 underline-offset-4 hover:underline" onClick={() => {
              if (confirm(t("privacy.wipeConfirm"))) {
                store.wipe();
                window.location.reload();
              }
            }}>
              {t("privacy.wipe")}
            </button>
          </div>

          <Warnings id="builder-warnings" warnings={warnings} onStrip={() => setContent({ request: stripUnsupported(content.request), graveDisplayName: stripUnsupported(content.graveDisplayName), signature: stripUnsupported(content.signature ?? ""), people: content.people.map((p) => ({ ...p, given: stripUnsupported(p.given), parent: stripUnsupported(p.parent ?? ""), freeText: stripUnsupported(p.freeText ?? "") })) })} unsupported={unsupported?.chars} />

          <div className="hidden items-center justify-between gap-4 rounded-xl bg-midnight-900 p-5 text-ivory-50 lg:flex">
            <div>
              <p className="text-sm text-ivory-100/70">{t("summary.pages", { count: pages })} · {t("summary.graves", { count: Math.max(1, slugs.length) })}</p>
              {unit && <p className="font-display text-2xl tabular">{t("summary.from", { price: formatMoney(unit.amountMinor, unit.currency, locale) })}</p>}
            </div>
            <Button type="submit" variant="gold" size="lg" loading={submitting} disabled={blocking.length > 0}>
              {draft.editingEntryId ? t("cta.update") : t("cta.continue")}
            </Button>
          </div>
        </form>

        {/* ───────────── LIVE PREVIEW STAGE (desktop) ───────────── */}
        <aside className="hidden lg:block" aria-label={t("preview.label")}>
          <div className="sticky top-28">
            <PreviewStage layout={layout} thermal={thermal} setThermal={setThermal} images={handImages} />
          </div>
        </aside>
      </div>

      {/* ───────────── MOBILE BOTTOM BAR ───────────── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-ivory-50/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-lg lg:hidden">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)} icon={<Eye className="size-4" />}>
            {t("preview.open")}
          </Button>
          <Button type="button" className="flex-1" loading={submitting} disabled={blocking.length > 0} onClick={submit}>
            {draft.editingEntryId ? t("cta.update") : t("cta.continue")}
          </Button>
        </div>
      </div>
      <Drawer open={previewOpen} onOpenChange={setPreviewOpen} title={t("preview.title")}>
        <PreviewStage layout={layout} thermal={thermal} setThermal={setThermal} images={handImages} compact />
      </Drawer>

      <GravePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        graves={graves}
        selected={slugs}
        onPick={(s) => {
          setSlugs(slugs.includes(s) ? slugs : [...slugs, s]);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}

function displayNameFor(g: BuilderGrave, nusach: string) {
  if (nusach === "he" || nusach === "yi") return g.nameHe;
  return g.namesByLocale[nusach] ?? g.namesByLocale.en ?? g.name;
}

function Section({ n, title, hint, children, icon }: { n: number; title: string; hint?: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft sm:p-7" aria-labelledby={`sec-${n}`}>
      <header className="mb-5 flex items-start gap-3">
        <span className="font-display mt-0.5 text-2xl leading-none text-gold-500 tabular">{String(n).padStart(2, "0")}</span>
        <div>
          <h2 id={`sec-${n}`} className="flex items-center gap-2 font-display text-2xl leading-tight text-midnight-900">
            {title} {icon && <span className="text-gold-600">{icon}</span>}
          </h2>
          {hint && <p className="mt-1 text-sm text-charcoal-500">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Warnings({ id, warnings, unsupported, onStrip }: { id: string; warnings: LayoutWarning[]; unsupported?: string[]; onStrip: () => void }) {
  const t = useTranslations("builder.warnings");
  if (!warnings.length) return <div id={id} tabIndex={-1} />;
  return (
    <div id={id} tabIndex={-1} className="space-y-2 outline-none" aria-live="polite">
      {warnings.map((w) => (
        <Notice key={w.code} tone={w.blocking ? "warning" : "info"}>
          {w.code === "unsupported_chars" ? (
            <>
              {t("unsupported_chars")} <bdi className="font-mono">{unsupported?.join(" ")}</bdi>{" "}
              <button type="button" onClick={onStrip} className="ms-1 font-medium underline underline-offset-2">
                {t("strip")}
              </button>
            </>
          ) : (
            t(w.code, { detail: w.detail ?? "" })
          )}
        </Notice>
      ))}
    </div>
  );
}

export function PreviewStage({ layout, thermal, setThermal, images, compact }: { layout: ReturnType<typeof usePreviewLayout>["layout"]; thermal: boolean; setThermal: (v: boolean) => void; images?: Record<string, CanvasImageSource>; compact?: boolean }) {
  const t = useTranslations("builder.preview");
  const first = useRef(true);
  useEffect(() => {
    first.current = false;
  }, []);
  return (
    <div className={cn("tex-stone relative overflow-hidden rounded-t-[12rem] rounded-b-xl ring-1 ring-stone-300/80", compact ? "rounded-t-[6rem]" : "shadow-lift")}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_40%_at_50%_0%,rgb(255_255_255/0.6),transparent_70%),radial-gradient(70%_50%_at_50%_100%,rgb(179_141_72/0.18),transparent_70%)]" aria-hidden />
      <svg viewBox="0 0 400 140" className="pointer-events-none absolute inset-x-0 top-0 w-full text-gold-500/50" aria-hidden>
        <path d="M30 140V120C30 60 110 14 200 8c90 6 170 52 170 112v20" fill="none" stroke="currentColor" strokeWidth=".8" />
      </svg>
      <div className={cn("relative flex flex-col items-center gap-2 px-6 sm:px-8", compact ? "pt-12" : "pt-20")}>
        <p className="eyebrow text-gold-700">{t("live")}</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-ivory-50/70 px-3 py-1 text-xs text-charcoal-600 ring-1 ring-stone-300/60">
          <ScanLine className="size-3.5" aria-hidden />
          {t("thermal")}
          <input type="checkbox" className="accent-[var(--color-midnight-900)]" checked={thermal} onChange={(e) => setThermal(e.target.checked)} />
        </label>
      </div>
      <div className={cn("relative px-6 pb-10 pt-6 sm:px-10", compact ? "max-h-none" : "max-h-[calc(100vh-14rem)] overflow-y-auto scroll-thin")}>
        {layout ? (
          <div className={cn("origin-top -rotate-[0.6deg] transition-transform", first.current && "paper-feed")}>
            <PaperSlips layout={layout} images={images} thermal={thermal} />
          </div>
        ) : (
          <div className="skeleton mx-auto h-96 w-full max-w-[19rem]" />
        )}
        {layout && (
          <p className="mt-6 text-center text-xs text-charcoal-500 tabular">
            {t("meta", { pages: layout.pages.length, mm: Math.round(layout.totalLengthMm) })}
          </p>
        )}
        <p className="mx-auto mt-2 max-w-xs text-center text-[0.72rem] leading-relaxed text-charcoal-500">{t("exact")}</p>
      </div>
    </div>
  );
}

function GravePicker({ open, onOpenChange, graves, selected, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; graves: BuilderGrave[]; selected: string[]; onPick: (slug: string) => void }) {
  const t = useTranslations("builder.picker");
  const ta = useTranslations("status.availability");
  const [q, setQ] = useState("");
  const list = graves.filter((g) => !q || `${g.name} ${g.nameHe} ${g.place}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("title")} description={t("subtitle")} wide>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} dir="auto" />
      <ul className="mt-4 grid max-h-[50vh] gap-2 overflow-y-auto scroll-thin sm:grid-cols-2">
        {list.map((g) => {
          const disabled = g.availability.kind === "not_purchasable" || selected.includes(g.slug);
          return (
            <li key={g.slug}>
              <button type="button" disabled={disabled} onClick={() => onPick(g.slug)} className="flex w-full items-center gap-3 rounded-lg border border-[var(--line)] bg-ivory-50 p-3 text-start transition-colors hover:border-gold-500 disabled:cursor-not-allowed disabled:opacity-50">
                <span className="tex-stone grid size-11 shrink-0 place-items-center rounded-t-full rounded-b-sm ring-1 ring-stone-300">
                  <span className="hebrew-name text-[0.7rem]" lang="he">
                    {g.nameHe.split(" ").slice(-1)[0]}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    <bdi>{g.name}</bdi>
                  </span>
                  <span className="block truncate text-xs text-charcoal-500">{ta(g.availability.kind === "available_now" ? "available_now" : g.availability.reason!)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

function TemplateGlyph({ tpl }: { tpl: "classic" | "arch" | "minimal" }) {
  return (
    <svg viewBox="0 0 40 56" className="h-14 w-10" aria-hidden>
      <rect x="2" y="2" width="36" height="52" rx="1" fill="#FBF9F3" stroke="#D2C3A3" />
      {tpl !== "minimal" && <path d={tpl === "arch" ? "M12 18V12c0-5 4-8 8-9 4 1 8 4 8 9v6" : "M15 12V9c0-3 2-4.5 5-5 3 .5 5 2 5 5v3"} fill="none" stroke="#1D1B18" strokeWidth="1" />}
      <path d="M10 24h20M12 30h16M10 36h20M14 42h12" stroke="#1D1B18" strokeOpacity=".5" />
      {tpl === "minimal" ? <path d="M15 20h10" stroke="#1D1B18" /> : <path d="M14 21q3-2 6 0t6 0" fill="none" stroke="#1D1B18" strokeWidth=".8" />}
    </svg>
  );
}
