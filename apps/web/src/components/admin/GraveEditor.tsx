"use client";

import { ExternalLink, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { adminDeleteGraveMedia, adminSaveGrave, adminSetGraveCover, adminUpdateGraveMedia, adminUploadGraveMedia, type GraveInput } from "@/app/actions/admin";
import { Badge, Button, Checkbox, Field, Input, Notice, Select, Textarea } from "@/components/ui";
import { LOCALE_NATIVE, type AppLocale } from "@/i18n/locales";
import { Link, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/format";

const TABS = ["general", "translations", "location", "hours", "media"] as const;
const HEB_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const mm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (s: string) => {
  const [h, m] = s.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

export function GraveEditor({ initial, media, assigned, canWrite, canPublish }: { initial: GraveInput; media: Array<{ id: string; credit: string | null; license: string | null; rightsVerified: boolean; width: number | null; height: number | null; role: string; focalX: number; focalY: number; alt: Record<string, string> | null }>; assigned: Array<{ id: string; name: string }>; canWrite: boolean; canPublish: boolean }) {
  const t = useTranslations("admin.graves.editor");
  const tg = useTranslations("admin.graves");
  const tw = useTranslations("common.weekdays");
  const router = useRouter();
  const [g, setG] = useState<GraveInput>(initial);
  const [tab, setTab] = useState<(typeof TABS)[number]>("general");
  const [loc, setLoc] = useState("he");
  const [aliasesText, setAliasesText] = useState(initial.aliases.join("\n"));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<GraveInput>) => setG((x) => ({ ...x, ...patch }));
  const tr = g.translations.find((x) => x.locale === loc)!;
  const setTr = (patch: Partial<GraveInput["translations"][number]>) => set({ translations: g.translations.map((x) => (x.locale === loc ? { ...x, ...patch } : x)) });

  const save = () =>
    start(async () => {
      const r = await adminSaveGrave({ ...g, aliases: aliasesText.split("\n").map((s) => s.trim()).filter(Boolean) });
      setMsg({ ok: r.ok, text: r.ok ? t("saved") : t.has(`errors.${r.error}`) ? t(`errors.${r.error}`) : r.error });
      if (r.ok && !g.id && r.id) router.replace(`/admin/graves/${r.id}`);
      else if (r.ok) router.refresh();
    });

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_20rem]">
      <div>
        <div role="tablist" aria-label={t("tabs")} className="mb-5 flex flex-wrap gap-1 border-b border-[var(--line)]">
          {TABS.map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm", tab === k ? "border-gold-500 font-semibold text-midnight-900" : "border-transparent text-charcoal-500 hover:text-midnight-900")}>
              {t(`tab.${k}`)}
            </button>
          ))}
        </div>
        <fieldset disabled={!canWrite} className="space-y-5 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-6 shadow-soft">
          {tab === "general" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("slug")} hint={t("slugHint")} htmlFor="slug"><Input id="slug" dir="ltr" value={g.slug} onChange={(e) => set({ slug: e.target.value.toLowerCase() })} /></Field>
              <Field label={t("status")} htmlFor="status">
                <Select id="status" value={g.status} onChange={(e) => set({ status: e.target.value as GraveInput["status"] })}>
                  {(["discovery_only", "coming_soon", "active", "paused", "maintenance"] as const).map((s) => <option key={s} value={s}>{tg(`status.${s}`)}</option>)}
                </Select>
              </Field>
              <Field label={t("permit")} hint={t("permitHint")} htmlFor="permit">
                <Select id="permit" value={g.permitStatus} onChange={(e) => set({ permitStatus: e.target.value as GraveInput["permitStatus"] })}>
                  {(["none", "requested", "approved", "revoked"] as const).map((s) => <option key={s} value={s}>{tg(`permit.${s}`)}</option>)}
                </Select>
              </Field>
              <Field label={t("dynasty")} htmlFor="dyn"><Input id="dyn" dir="ltr" value={g.dynasty ?? ""} onChange={(e) => set({ dynasty: e.target.value })} /></Field>
              <Field label={t("permitNotes")} htmlFor="pn" className="sm:col-span-2"><Textarea id="pn" rows={2} className="min-h-0" value={g.permitNotes ?? ""} onChange={(e) => set({ permitNotes: e.target.value })} /></Field>
              <Field label={t("era")} htmlFor="era">
                <div className="flex gap-2">
                  <Input id="era" type="number" value={g.eraStartYear ?? ""} onChange={(e) => set({ eraStartYear: e.target.value ? Number(e.target.value) : null })} />
                  <Input aria-label={t("eraEnd")} type="number" value={g.eraEndYear ?? ""} onChange={(e) => set({ eraEndYear: e.target.value ? Number(e.target.value) : null })} />
                </div>
              </Field>
              <Field label={t("sort")} htmlFor="sort"><Input id="sort" type="number" value={g.sortOrder} onChange={(e) => set({ sortOrder: Number(e.target.value) })} /></Field>
              <Checkbox checked={g.featured} onChange={(e) => set({ featured: e.target.checked })} label={t("featured")} />
              <Checkbox checked={g.published} disabled={!canPublish} onChange={(e) => set({ published: e.target.checked })} label={t("published")} description={canPublish ? t("publishedHint") : t("publishNoPerm")} />
              <div className="sm:col-span-2">
                <Field label={t("aliases")} hint={t("aliasesHint")} htmlFor="aliases"><Textarea id="aliases" rows={5} dir="auto" value={aliasesText} onChange={(e) => setAliasesText(e.target.value)} /></Field>
              </div>
            </div>
          )}

          {tab === "translations" && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {g.translations.map((x) => (
                  <button key={x.locale} type="button" onClick={() => setLoc(x.locale)} className={cn("rounded-full border px-3 py-1 text-sm", loc === x.locale ? "border-midnight-900 bg-midnight-900 text-ivory-50" : "border-[var(--line-strong)]")}>
                    <span lang={x.locale}>{LOCALE_NATIVE[x.locale as AppLocale]}</span>
                    <span className={cn("ms-2 inline-block size-1.5 rounded-full align-middle", !x.name ? "bg-oxblood-600" : x.reviewed ? "bg-sage-600" : "bg-ochre-600")} aria-hidden />
                  </button>
                ))}
              </div>
              <div className="grid gap-5 sm:grid-cols-2" lang={loc} dir={loc === "he" || loc === "yi" ? "rtl" : "ltr"}>
                <Field label={t("name")} htmlFor="tn"><Input id="tn" value={tr.name} onChange={(e) => setTr({ name: e.target.value })} /></Field>
                <Field label={t("epithet")} htmlFor="te"><Input id="te" value={tr.epithet ?? ""} onChange={(e) => setTr({ epithet: e.target.value })} /></Field>
                <Field label={t("place")} htmlFor="tp"><Input id="tp" value={tr.placeName ?? ""} onChange={(e) => setTr({ placeName: e.target.value })} /></Field>
                <Field label={t("address")} htmlFor="ta"><Input id="ta" value={tr.address ?? ""} onChange={(e) => setTr({ address: e.target.value })} /></Field>
                <Field label={t("bio")} htmlFor="tb" className="sm:col-span-2"><Textarea id="tb" rows={5} value={tr.bio ?? ""} onChange={(e) => setTr({ bio: e.target.value })} /></Field>
                <Field label={t("sources")} hint={t("sourcesHint")} htmlFor="ts" className="sm:col-span-2"><Input id="ts" value={tr.bioSources ?? ""} onChange={(e) => setTr({ bioSources: e.target.value })} /></Field>
                <Field label={t("customs")} htmlFor="tc" className="sm:col-span-2"><Textarea id="tc" rows={3} className="min-h-0" value={tr.customs ?? ""} onChange={(e) => setTr({ customs: e.target.value })} /></Field>
                <Field label={t("metaTitle")} hint={`${(tr.metaTitle ?? "").length}/70`} htmlFor="tmt"><Input id="tmt" maxLength={70} value={tr.metaTitle ?? ""} onChange={(e) => setTr({ metaTitle: e.target.value })} /></Field>
                <Field label={t("metaDescription")} hint={`${(tr.metaDescription ?? "").length}/170`} htmlFor="tmd"><Input id="tmd" maxLength={170} value={tr.metaDescription ?? ""} onChange={(e) => setTr({ metaDescription: e.target.value })} /></Field>
                <Checkbox checked={tr.reviewed} onChange={(e) => setTr({ reviewed: e.target.checked })} label={t("reviewed")} description={t("reviewedHint")} />
              </div>
            </>
          )}

          {tab === "location" && (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t("country")} hint={t("countryHint")} htmlFor="cc"><Input id="cc" dir="ltr" maxLength={2} value={g.countryCode} onChange={(e) => set({ countryCode: e.target.value.toUpperCase() })} /></Field>
              <Field label={t("city")} htmlFor="ck"><Input id="ck" dir="ltr" value={g.cityKey} onChange={(e) => set({ cityKey: e.target.value })} /></Field>
              <Field label={t("timezone")} hint={t("timezoneHint")} htmlFor="tz"><Input id="tz" dir="ltr" value={g.timezone} onChange={(e) => set({ timezone: e.target.value })} /></Field>
              <div />
              <Field label={t("lat")} htmlFor="lat"><Input id="lat" dir="ltr" type="number" step="any" value={g.lat ?? ""} onChange={(e) => set({ lat: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              <Field label={t("lng")} htmlFor="lng"><Input id="lng" dir="ltr" type="number" step="any" value={g.lng ?? ""} onChange={(e) => set({ lng: e.target.value === "" ? null : Number(e.target.value) })} /></Field>
              <Field label={t("verificationSource")} htmlFor="vs" className="sm:col-span-2"><Input id="vs" value={g.verificationSource ?? ""} onChange={(e) => set({ verificationSource: e.target.value })} /></Field>
              <Checkbox checked={g.locationVerified} onChange={(e) => set({ locationVerified: e.target.checked })} label={t("locationVerified")} description={t("locationVerifiedHint")} />
            </div>
          )}

          {tab === "hours" && (
            <>
              <div className="grid gap-3">
                {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
                  const row = g.schedules.find((s) => s.weekday === wd);
                  return (
                    <div key={wd} className="grid grid-cols-[7rem_auto_1fr_1fr] items-center gap-3 text-sm">
                      <span>{tw(String(wd))}</span>
                      <input type="checkbox" aria-label={t("open")} checked={!!row} onChange={(e) => set({ schedules: e.target.checked ? [...g.schedules, { weekday: wd, openMinute: 420, closeMinute: wd === 5 ? 720 : 1260 }] : g.schedules.filter((s) => s.weekday !== wd) })} />
                      <Input type="time" aria-label={t("opens")} disabled={!row} value={row ? mm(row.openMinute) : ""} onChange={(e) => set({ schedules: g.schedules.map((s) => (s.weekday === wd ? { ...s, openMinute: toMin(e.target.value) } : s)) })} />
                      <Input type="time" aria-label={t("closes")} disabled={!row} value={row ? mm(row.closeMinute) : ""} onChange={(e) => set({ schedules: g.schedules.map((s) => (s.weekday === wd ? { ...s, closeMinute: toMin(e.target.value) } : s)) })} />
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-2">
                <Checkbox checked={g.observeShabbat} onChange={(e) => set({ observeShabbat: e.target.checked })} label={t("shabbat")} />
                <Checkbox checked={g.observeYomTov} onChange={(e) => set({ observeYomTov: e.target.checked })} label={t("yomTov")} />
                <Checkbox checked={g.israelHolidays} onChange={(e) => set({ israelHolidays: e.target.checked })} label={t("israel")} />
                <div className="sm:col-span-2">
                  <Checkbox checked={g.testIntake} onChange={(e) => set({ testIntake: e.target.checked })} label={t("testIntake")} />
                  <p className="mt-1 text-xs text-[var(--color-warning-700,#8a5a00)]">{t("testIntakeHint")}</p>
                </div>
                <Field label={t("cutoff")} hint={t("cutoffHint")} htmlFor="cut"><Input id="cut" type="time" value={mm(g.shabbatCutoffMinute)} onChange={(e) => set({ shabbatCutoffMinute: toMin(e.target.value) })} /></Field>
              </div>
              <div className="grid gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-4">
                <Field label={t("hilulaDay")} htmlFor="hd"><Input id="hd" type="number" min={1} max={30} value={g.hilula?.day ?? ""} onChange={(e) => set({ hilula: e.target.value ? { day: Number(e.target.value), month: g.hilula?.month ?? 1, year: g.hilula?.year ?? null, verified: g.hilula?.verified ?? false, sourceNote: g.hilula?.sourceNote } : null })} /></Field>
                <Field label={t("hilulaMonth")} htmlFor="hm">
                  <Select id="hm" value={g.hilula?.month ?? 1} disabled={!g.hilula} onChange={(e) => g.hilula && set({ hilula: { ...g.hilula, month: Number(e.target.value) } })}>
                    {HEB_MONTHS.map((m) => <option key={m} value={m}>{t(`months.${m}`)}</option>)}
                  </Select>
                </Field>
                <Field label={t("hilulaYear")} htmlFor="hy"><Input id="hy" type="number" disabled={!g.hilula} value={g.hilula?.year ?? ""} onChange={(e) => g.hilula && set({ hilula: { ...g.hilula, year: e.target.value ? Number(e.target.value) : null } })} /></Field>
                <div className="pt-6"><Checkbox disabled={!g.hilula} checked={!!g.hilula?.verified} onChange={(e) => g.hilula && set({ hilula: { ...g.hilula, verified: e.target.checked } })} label={t("hilulaVerified")} /></div>
              </div>
            </>
          )}

          {tab === "media" && (
            <MediaTab graveId={g.id} media={media} />
          )}
        </fieldset>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft">
          <div className="flex flex-wrap gap-2">
            <Badge tone={g.published ? "success" : "neutral"}>{g.published ? t("live") : t("draftState")}</Badge>
            <Badge tone={g.status === "active" ? "success" : "neutral"}>{tg(`status.${g.status}`)}</Badge>
          </div>
          {g.status === "active" && g.permitStatus !== "approved" && <Notice tone="warning" className="mt-4">{t("errors.active_requires_permit")}</Notice>}
          {canWrite && <Button className="mt-5 w-full" loading={pending} onClick={save}>{t("save")}</Button>}
          {msg && <p role="status" className={cn("mt-3 text-sm", msg.ok ? "text-sage-600" : "text-oxblood-600")}>{msg.text}</p>}
          {g.id && g.slug && (
            <Link href={`/graves/${g.slug}?preview=1`} target="_blank" className="mt-4 inline-flex items-center gap-1.5 text-sm text-midnight-900 underline-offset-4 hover:underline">
              <ExternalLink className="size-3.5" /> {t("preview")}
            </Link>
          )}
        </div>
        <div className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-5 text-sm shadow-soft">
          <p className="font-semibold text-midnight-900">{t("devices")}</p>
          {assigned.length === 0 ? <p className="mt-2 text-charcoal-500">{t("noDevices")}</p> : (
            <ul className="mt-2 space-y-1">{assigned.map((d) => <li key={d.id}><Link href={`/admin/devices/${d.id}`} className="underline-offset-4 hover:underline">{d.name}</Link></li>)}</ul>
          )}
          <Link href="/admin/devices/pair" className="mt-3 inline-block text-gold-700 hover:underline">{t("pair")}</Link>
        </div>
        <p className="text-xs leading-relaxed text-charcoal-500">{t("honesty")}</p>
      </aside>
    </div>
  );
}

type MediaRow = { id: string; credit: string | null; license: string | null; rightsVerified: boolean; width: number | null; height: number | null; role: string; focalX: number; focalY: number; alt: Record<string, string> | null };

function MediaTab({ graveId, media }: { graveId?: string; media: MediaRow[] }) {
  const t = useTranslations("admin.graves.editor");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  if (!graveId) return <p className="text-sm text-charcoal-500">{t("saveFirst")}</p>;
  // Same rule as the public site: the cover is the first rights-verified photo in order.
  const coverId = media.find((m) => m.rightsVerified)?.id;
  const errText = (code: string) => (t.has(`mediaErrors.${code}`) ? t(`mediaErrors.${code}`) : t("mediaErrors.invalid"));
  return (
    <div className="space-y-5">
      <Notice tone="gold">{t("mediaPolicy")}</Notice>
      {media.length === 0 ? (
        <p className="text-sm text-charcoal-500">{t("noMedia")}</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {media.map((m) => (
            <MediaItem key={m.id} m={m} isCover={m.id === coverId} />
          ))}
        </ul>
      )}
      <form
        key={formKey}
        className="grid gap-4 border-t border-[var(--line)] pt-5 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          const fd = new FormData(e.currentTarget);
          fd.set("graveId", graveId);
          start(async () => {
            const r = await adminUploadGraveMedia(fd);
            if (r.ok) {
              setFormKey((k) => k + 1);
              router.refresh();
            } else setErr(errText(r.error));
          });
        }}
      >
        <p className="font-medium sm:col-span-2">{t("uploadTitle")}</p>
        <Field label={t("file")} htmlFor="mf" className="sm:col-span-2"><input id="mf" name="file" type="file" accept="image/jpeg,image/png,image/webp" required className="text-sm" /></Field>
        <Field label={t("credit")} htmlFor="mc"><Input id="mc" name="credit" dir="auto" /></Field>
        <Field label={t("license")} htmlFor="ml" hint={t("licenseHint")}><Input id="ml" name="license" dir="auto" /></Field>
        <div className="sm:col-span-2"><Checkbox name="rightsVerified" label={t("rightsConfirm")} /></div>
        <p className="text-xs text-charcoal-500 sm:col-span-2">{t("uploadNote")}</p>
        <div><Button type="submit" size="sm" loading={pending} icon={<Upload className="size-4" />}>{t("upload")}</Button></div>
        {err && <p className="text-sm text-oxblood-600 sm:col-span-2" role="alert">{err}</p>}
      </form>
    </div>
  );
}

function MediaItem({ m, isCover }: { m: MediaRow; isCover: boolean }) {
  const t = useTranslations("admin.graves.editor");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [credit, setCredit] = useState(m.credit ?? "");
  const [license, setLicense] = useState(m.license ?? "");
  const [rights, setRights] = useState(m.rightsVerified);
  const [role, setRole] = useState(m.role);
  const [fx, setFx] = useState(m.focalX);
  const [fy, setFy] = useState(m.focalY);
  const [altHe, setAltHe] = useState(m.alt?.he ?? "");
  const [altEn, setAltEn] = useState(m.alt?.en ?? "");
  const [err, setErr] = useState<string | null>(null);
  const dirty = credit !== (m.credit ?? "") || license !== (m.license ?? "") || rights !== m.rightsVerified || role !== m.role || fx !== m.focalX || fy !== m.focalY || altHe !== (m.alt?.he ?? "") || altEn !== (m.alt?.en ?? "");
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setErr(null);
      const r = await fn();
      if (r.ok) router.refresh();
      else setErr(t.has(`mediaErrors.${r.error}`) ? t(`mediaErrors.${r.error}`) : t("mediaErrors.invalid"));
    });
  return (
    <li className="overflow-hidden rounded-lg border border-[var(--line)] bg-ivory-50">
      <div className="relative aspect-[4/3] bg-stone-200">
        {/* eslint-disable-next-line @next/next/no-img-element -- admin preview through the permission-checked media route */}
        <img src={`/api/media/grave/${m.id}`} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: `${fx}% ${fy}%` }} loading="lazy" />
        <div className="absolute inset-x-2 top-2 flex flex-wrap gap-1.5">
          <Badge tone={m.rightsVerified ? "success" : "warning"}>{m.rightsVerified ? t("rightsOk") : t("rightsMissing")}</Badge>
          {isCover && <Badge tone="gold">{t("cover")}</Badge>}
        </div>
      </div>
      <div className="space-y-3 p-3 text-sm">
        <p className="text-xs text-charcoal-500">
          <bdi className="tabular" dir="ltr">{m.width}×{m.height}</bdi>
          {(m.width ?? 0) < 1200 && <span className="ms-2 text-ochre-600">{t("lowRes")}</span>}
        </p>
        <Field label={t("credit")} htmlFor={`c-${m.id}`}><Input id={`c-${m.id}`} value={credit} onChange={(e) => setCredit(e.target.value)} dir="auto" /></Field>
        <Field label={t("license")} htmlFor={`l-${m.id}`}><Input id={`l-${m.id}`} value={license} onChange={(e) => setLicense(e.target.value)} dir="auto" /></Field>
        <Field label={t("role")} htmlFor={`r-${m.id}`} hint={t("roleHint")}>
          <select id={`r-${m.id}`} value={role} onChange={(e) => setRole(e.target.value)} className="h-11 w-full rounded-md border border-[var(--line-strong)] bg-ivory-50 px-3 text-sm">
            {(["hero", "writing", "mobile", "gallery"] as const).map((r) => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("focalX")} htmlFor={`fx-${m.id}`}><input id={`fx-${m.id}`} type="range" min={0} max={100} value={fx} onChange={(e) => setFx(Number(e.target.value))} className="w-full accent-[var(--color-gold-500)]" /></Field>
          <Field label={t("focalY")} htmlFor={`fy-${m.id}`}><input id={`fy-${m.id}`} type="range" min={0} max={100} value={fy} onChange={(e) => setFy(Number(e.target.value))} className="w-full accent-[var(--color-gold-500)]" /></Field>
        </div>
        <Field label={t("altHe")} htmlFor={`ah-${m.id}`}><Input id={`ah-${m.id}`} value={altHe} onChange={(e) => setAltHe(e.target.value)} dir="rtl" /></Field>
        <Field label={t("altEn")} htmlFor={`ae-${m.id}`}><Input id={`ae-${m.id}`} value={altEn} onChange={(e) => setAltEn(e.target.value)} dir="ltr" /></Field>
        <Checkbox checked={rights} onChange={(e) => setRights(e.target.checked)} label={t("rightsConfirm")} />
        {err && <p className="text-xs text-oxblood-600" role="alert">{err}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" disabled={!dirty} loading={pending} onClick={() => run(() => adminUpdateGraveMedia({ id: m.id, credit, license, rightsVerified: rights, role: role as "hero", focalX: fx, focalY: fy, altHe, altEn }))}>{t("save")}</Button>
          {!isCover && <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => adminSetGraveCover(m.id))}>{t("makeCover")}</Button>}
          <Button type="button" size="sm" variant="danger" disabled={pending} onClick={() => { if (window.confirm(t("deleteConfirm"))) run(() => adminDeleteGraveMedia(m.id)); }}>{t("deletePhoto")}</Button>
        </div>
      </div>
    </li>
  );
}
