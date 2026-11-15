"use client";

import { Eye, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { stripUnsupported, type KvittelContent, type LayoutWarning } from "@kvittel/print-layout";
import { validateKvittel } from "@/app/actions/public";
import { HandwritingUpload } from "@/components/builder/HandwritingUpload";
import { PaperSlips, usePreviewLayout } from "@/components/builder/KvittelPreview";
import { Button, Checkbox, Drawer, Field, Input, Notice, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { LIMITS, type KvittelContentInput } from "@/lib/kvittel-schema";
import { hebrewDate } from "@/lib/format";
import { detectNusach } from "@/lib/nusach";
import { emptyContent, hasText, newId, store, useStore } from "@/lib/store";
import type { BuilderGrave } from "./types";

/**
 * The whole act of writing: names + a request, and the note appearing beside it as it will print.
 * No templates, no styles, no categories. The note's language and direction follow the text.
 */
export function Writer({ grave, flags }: { grave: BuilderGrave; flags: { handwriting: boolean } }) {
  const t = useTranslations("site.write");
  const tw = useTranslations("builder.warnings");
  const locale = useLocale();
  const router = useRouter();
  const draft = useStore((s) => s.draft);
  const remember = useStore((s) => s.remember);
  const [hydrated, setHydrated] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [serverWarnings, setServerWarnings] = useState<LayoutWarning[] | null>(null);
  const [handImages, setHandImages] = useState<Record<string, HTMLImageElement>>({});
  const [submitting, startSubmit] = useTransition();
  const displayName = (nusach: string) => (nusach === "he" || nusach === "yi" ? grave.nameHe : (grave.namesByLocale[nusach] ?? grave.namesByLocale.en ?? grave.name));

  // Restore whatever was already typed (language switch, other tzaddik, back from payment) and aim it at this tzaddik.
  useEffect(() => {
    const s = store.get().draft;
    if (s && hasText(s.content)) {
      const editing = s.editingEntryId && s.graveSlugs.includes(grave.slug) ? s.editingEntryId : null;
      store.setDraft({ graveSlugs: [grave.slug], content: { ...s.content, template: "simple", graveDisplayName: displayName(s.content.nusach) }, editingEntryId: editing });
    } else {
      const n = detectNusach("", locale);
      store.setDraft({ graveSlugs: [grave.slug], content: emptyContent(n, displayName(n)), editingEntryId: null });
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grave.slug]);

  const content: KvittelContentInput = draft?.content ?? emptyContent(detectNusach("", locale));
  const update = (patch: Partial<KvittelContentInput>) => {
    if (!draft) return;
    setServerWarnings(null);
    const next = { ...draft.content, ...patch };
    const text = [...next.people.map((p) => p.freeText ?? ""), next.request].join("\n");
    const nusach = detectNusach(text, locale);
    store.setDraft({ ...draft, graveSlugs: [grave.slug], content: { ...next, template: "simple", showBH: false, nusach, graveDisplayName: displayName(nusach) } });
  };
  const setName = (id: string, freeText: string) => update({ people: content.people.map((p) => (p.id === id ? { ...p, mode: "free", freeText } : p)) });

  const deferred = useDeferredValue(content);
  const opts = useMemo(() => ({ dateLine: hebrewDate(new Date(), deferred.nusach === "he" || deferred.nusach === "yi" ? "he" : deferred.nusach), reference: "KV·PREVIEW" }), [deferred.nusach]);
  const { layout } = usePreviewLayout(deferred as KvittelContent, opts);
  const warnings = (serverWarnings ?? layout?.warnings ?? []).filter((w) => w.code !== "empty");
  const unsupported = warnings.find((w) => w.code === "unsupported_chars");
  const blocking = (serverWarnings ?? layout?.warnings ?? []).some((w) => w.blocking);
  const empty = !hasText(content);

  const submit = () =>
    startSubmit(async () => {
      if (!draft || empty) return;
      const v = await validateKvittel(content);
      if (!v.ok) {
        setServerWarnings(v.warnings as LayoutWarning[]);
        return;
      }
      store.addToCart({ id: draft.editingEntryId ?? newId(), graveSlugs: [grave.slug], content });
      router.push("/checkout");
    });

  const names = content.people;
  const names2 = hydrated ? names : [{ id: "ph", mode: "free" as const, given: "", relation: "none" as const, freeText: "" }];

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="rounded-2xl border border-[var(--line)] bg-ivory-50/95 p-5 shadow-lift backdrop-blur-md sm:p-8"
        aria-label={t("formLabel", { name: grave.name })}
      >
        <fieldset className="space-y-3" disabled={!hydrated}>
          <legend className="font-display text-xl text-midnight-900">{t("names.label")}</legend>
          <p className="-mt-1 text-sm text-charcoal-500">{t("names.hint")}</p>
          <ul className="space-y-2.5">
            {names2.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2">
                <Input
                  dir="auto"
                  value={p.freeText ?? ""}
                  maxLength={LIMITS.nameChars * 2}
                  placeholder={i === 0 ? t("names.placeholder") : t("names.placeholderMore")}
                  aria-label={t("names.nth", { n: i + 1 })}
                  autoComplete="off"
                  enterKeyHint="next"
                  className="h-13 text-[1.1rem]"
                  onChange={(e) => setName(p.id, e.target.value)}
                />
                {names.length > 1 && (
                  <button type="button" className="grid size-11 shrink-0 place-items-center rounded-full text-charcoal-500 hover:bg-stone-100 hover:text-oxblood-600" aria-label={t("names.remove", { n: i + 1 })} onClick={() => update({ people: names.filter((x) => x.id !== p.id) })}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {names.length < LIMITS.people && (
            <button type="button" onClick={() => update({ people: [...names, { id: newId(), mode: "free", given: "", relation: "none", freeText: "" }] })} className="inline-flex items-center gap-1.5 py-1 text-sm font-medium text-midnight-900 underline-offset-4 hover:underline">
              <Plus className="size-4 text-gold-600" /> {t("names.add")}
            </button>
          )}
        </fieldset>

        <Field label={<span className="font-display text-xl text-midnight-900">{t("request.label")}</span>} htmlFor="request" className="mt-7" hint={content.request.length > LIMITS.requestChars * 0.7 ? <span className="tabular">{content.request.length}/{LIMITS.requestChars}</span> : undefined}>
          <Textarea
            id="request"
            dir="auto"
            rows={6}
            maxLength={LIMITS.requestChars}
            value={content.request}
            placeholder={t("request.placeholder")}
            disabled={!hydrated}
            className="min-h-40 text-[1.1rem] leading-relaxed"
            onChange={(e) => update({ request: e.target.value })}
          />
        </Field>

        <details className="group mt-6 border-t border-[var(--line)] pt-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-charcoal-600 hover:text-midnight-900">{t("more.title")}</summary>
          <div className="mt-4 space-y-5">
            {flags.handwriting && (
              <div>
                <p className="text-sm font-medium text-charcoal-800">{t("more.handwriting")}</p>
                <p className="mb-3 text-xs text-charcoal-500">{t("more.handwritingHint")}</p>
                <HandwritingUpload
                  value={content.handwritingRef ? { ref: content.handwritingRef, size: content.handwritingSize! } : null}
                  onChange={(v, img) => {
                    if (v && img) setHandImages((m) => ({ ...m, [v.ref]: img }));
                    update({ handwritingRef: v?.ref, handwritingSize: v?.size });
                  }}
                />
              </div>
            )}
            <Checkbox checked={remember} onChange={(e) => store.setRemember(e.target.checked)} label={t("more.remember")} description={t("more.rememberHint")} />
            <button
              type="button"
              className="text-sm text-oxblood-600 underline-offset-4 hover:underline"
              onClick={() => {
                if (confirm(t("more.wipeConfirm"))) {
                  store.wipe();
                  window.location.reload();
                }
              }}
            >
              {t("more.wipe")}
            </button>
          </div>
        </details>

        {warnings.length > 0 && (
          <div className="mt-5 space-y-2" aria-live="polite">
            {warnings.map((w) => (
              <Notice key={w.code} tone={w.blocking ? "warning" : "info"}>
                {w.code === "unsupported_chars" ? (
                  <>
                    {tw("unsupported_chars")} <bdi className="font-mono">{unsupported?.chars?.join(" ")}</bdi>{" "}
                    <button type="button" className="ms-1 font-medium underline underline-offset-2" onClick={() => update({ request: stripUnsupported(content.request), people: content.people.map((p) => ({ ...p, freeText: stripUnsupported(p.freeText ?? "") })) })}>
                      {tw("strip")}
                    </button>
                  </>
                ) : (
                  tw(w.code, { detail: w.detail ?? "" })
                )}
              </Notice>
            ))}
          </div>
        )}

        <div className="mt-7 hidden lg:block">
          <Button type="submit" variant="primary" size="xl" className="w-full" loading={submitting} disabled={empty || blocking || !hydrated}>
            {draft?.editingEntryId ? t("update") : t("continue")}
          </Button>
          <p className="mt-3 text-center text-xs text-charcoal-500">{t("noPriceYet")}</p>
        </div>
      </form>

      {/* live note — desktop */}
      <aside className="hidden lg:block" aria-label={t("preview.title")}>
        <div className="sticky top-24">
          <NotePreview layout={layout} images={handImages} />
        </div>
      </aside>

      {/* mobile bottom bar: fields are never covered by the preview */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-ivory-50/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 backdrop-blur-lg lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <Button type="button" variant="outline" size="lg" onClick={() => setPreviewOpen(true)} icon={<Eye className="size-4" />}>
            {t("preview.open")}
          </Button>
          <Button type="button" size="lg" className="flex-1" loading={submitting} disabled={empty || blocking || !hydrated} onClick={submit}>
            {draft?.editingEntryId ? t("update") : t("continue")}
          </Button>
        </div>
      </div>
      <Drawer open={previewOpen} onOpenChange={setPreviewOpen} title={t("preview.title")} closeLabel={t("preview.close")}>
        <NotePreview layout={layout} images={handImages} compact />
      </Drawer>
    </>
  );
}

export function NotePreview({ layout, images, compact }: { layout: ReturnType<typeof usePreviewLayout>["layout"]; images?: Record<string, CanvasImageSource>; compact?: boolean }) {
  const t = useTranslations("site.write.preview");
  return (
    <div className="rounded-2xl bg-ivory-200/70 p-5 ring-1 ring-stone-300/70 backdrop-blur-sm sm:p-8">
      <p className="eyebrow mb-5 text-center text-gold-700">{t("title")}</p>
      <div className={compact ? "" : "max-h-[calc(100dvh-13rem)] overflow-y-auto scroll-thin"}>
        {layout ? <PaperSlips layout={layout} images={images} /> : <div className="skeleton mx-auto h-72 w-full max-w-[19rem]" />}
      </div>
      <p className="mt-5 text-center text-xs text-charcoal-500">{t("exact")}</p>
    </div>
  );
}
