"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition, type ReactNode } from "react";
import { adminAnonymizeCustomer, adminGrantRole, adminRemoveOverride, adminRevokeRole, adminSaveCoupon, adminSavePage, adminSavePartner, adminSetBundle, adminSetPartnerGraves, adminSetPrice, adminToggleFlag } from "@/app/actions/admin";
import { Button, Checkbox, Field, Input, Modal, Select, Textarea } from "@/components/ui";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/format";

function useRun() {
  const router = useRouter();
  const t = useTranslations("admin.common");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg({ ok: r.ok, text: r.ok ? (r.message ?? t("saved")) : (r.error ?? t("error")) });
      if (r.ok) router.refresh();
    });
  const Msg = () => (msg ? <span role="status" className={cn("text-xs", msg.ok ? "text-sage-600" : "text-oxblood-600")}>{msg.text}</span> : null);
  return { pending, run, Msg };
}

export function PriceCell({ scope, graveId, item, currency, amountMinor, canWrite }: { scope: "default" | "grave"; graveId?: string; item: "kvittel" | "extra_page"; currency: string; amountMinor: number | null; canWrite: boolean }) {
  const [v, setV] = useState(amountMinor === null ? "" : (amountMinor / 100).toFixed(2));
  const { pending, run, Msg } = useRun();
  if (!canWrite) return <span className="tabular">{amountMinor === null ? "—" : (amountMinor / 100).toFixed(2)}</span>;
  const changed = v !== (amountMinor === null ? "" : (amountMinor / 100).toFixed(2));
  return (
    <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); run(() => adminSetPrice({ scope, graveId, item, currency, amountMinor: Math.round(Number(v) * 100) })); }}>
      <Input aria-label={`${item} ${currency}`} value={v} onChange={(e) => setV(e.target.value.replace(/[^0-9.]/g, ""))} className="h-9 w-24 text-end tabular" dir="ltr" />
      {changed && <Button size="sm" loading={pending} disabled={v === ""}>✓</Button>}
      <Msg />
    </form>
  );
}

export function EndOverride({ priceId }: { priceId: string }) {
  const t = useTranslations("admin.pricing");
  const { pending, run } = useRun();
  return <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => adminRemoveOverride(priceId))}>{t("endOverride")}</Button>;
}

export function BundleForm({ bps, canWrite }: { bps: number; canWrite: boolean }) {
  const t = useTranslations("admin.pricing");
  const [v, setV] = useState(String(bps / 100));
  const { pending, run, Msg } = useRun();
  return (
    <form className="flex items-end gap-3" onSubmit={(e) => { e.preventDefault(); run(() => adminSetBundle(Math.round(Number(v) * 100))); }}>
      <Field label={t("bundlePct")} htmlFor="bundle"><Input id="bundle" value={v} disabled={!canWrite} onChange={(e) => setV(e.target.value)} className="w-28 tabular" dir="ltr" /></Field>
      {canWrite && <Button size="sm" loading={pending}>{t("save")}</Button>}
      <Msg />
    </form>
  );
}

export function CouponForm() {
  const t = useTranslations("admin.pricing.coupon");
  const [c, setC] = useState({ code: "", kind: "percent" as "percent" | "fixed", value: "10", currency: "USD", maxRedemptions: "", validTo: "", active: true });
  const { pending, run, Msg } = useRun();
  return (
    <form className="grid gap-3 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); run(() => adminSaveCoupon({ code: c.code, kind: c.kind, value: c.kind === "percent" ? Math.round(Number(c.value) * 100) : Math.round(Number(c.value) * 100), currency: c.kind === "fixed" ? c.currency : undefined, maxRedemptions: c.maxRedemptions ? Number(c.maxRedemptions) : null, validTo: c.validTo || null, active: c.active })); }}>
      <Field label={t("code")} htmlFor="cc"><Input id="cc" dir="ltr" value={c.code} onChange={(e) => setC({ ...c, code: e.target.value.toUpperCase() })} /></Field>
      <Field label={t("kind")} htmlFor="ck"><Select id="ck" value={c.kind} onChange={(e) => setC({ ...c, kind: e.target.value as "percent" | "fixed" })}><option value="percent">{t("percent")}</option><option value="fixed">{t("fixed")}</option></Select></Field>
      <Field label={c.kind === "percent" ? t("valuePct") : t("valueAmount")} htmlFor="cv"><Input id="cv" dir="ltr" value={c.value} onChange={(e) => setC({ ...c, value: e.target.value })} /></Field>
      {c.kind === "fixed" ? <Field label={t("currency")} htmlFor="ccur"><Select id="ccur" value={c.currency} onChange={(e) => setC({ ...c, currency: e.target.value })}>{["USD", "EUR", "ILS", "GBP", "CAD", "AUD"].map((x) => <option key={x}>{x}</option>)}</Select></Field> : <div />}
      <Field label={t("max")} htmlFor="cm"><Input id="cm" type="number" value={c.maxRedemptions} onChange={(e) => setC({ ...c, maxRedemptions: e.target.value })} /></Field>
      <Field label={t("validTo")} htmlFor="cvt"><Input id="cvt" type="date" value={c.validTo} onChange={(e) => setC({ ...c, validTo: e.target.value })} /></Field>
      <div className="flex items-end gap-3 sm:col-span-2"><Checkbox checked={c.active} onChange={(e) => setC({ ...c, active: e.target.checked })} label={t("active")} /><Button size="sm" loading={pending} disabled={c.code.length < 3}>{t("save")}</Button><Msg /></div>
    </form>
  );
}

export function FlagToggle({ flag, enabled, canWrite }: { flag: string; enabled: boolean; canWrite: boolean }) {
  const { pending, run } = useRun();
  return (
    <button type="button" role="switch" aria-checked={enabled} aria-label={flag} disabled={!canWrite || pending} onClick={() => run(() => adminToggleFlag(flag, !enabled))} className={cn("relative h-6 w-11 rounded-full transition-colors disabled:opacity-50", enabled ? "bg-sage-600" : "bg-stone-300")}>
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-ivory-50 shadow transition-all", enabled ? "start-[1.375rem]" : "start-0.5")} />
    </button>
  );
}

export function GrantRole({ partners }: { partners: Array<{ id: string; name: string }> }) {
  const t = useTranslations("admin.settings.roles");
  const tr = useTranslations("admin.nav.roles");
  const [f, setF] = useState({ email: "", role: "support_limited", partnerId: "" });
  const { pending, run, Msg } = useRun();
  const scoped = f.role === "partner_manager" || f.role === "local_maintainer";
  return (
    <form className="grid gap-3 sm:grid-cols-[1fr_12rem_12rem_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); run(() => adminGrantRole({ email: f.email, role: f.role, partnerId: scoped ? f.partnerId : null })); }}>
      <Field label={t("email")} htmlFor="re"><Input id="re" dir="ltr" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label={t("role")} htmlFor="rr"><Select id="rr" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{["admin", "finance", "support_limited", "content_editor", "partner_manager", "local_maintainer", "super_admin"].map((r) => <option key={r} value={r}>{tr(r)}</option>)}</Select></Field>
      <Field label={t("partner")} htmlFor="rp"><Select id="rp" disabled={!scoped} value={f.partnerId} onChange={(e) => setF({ ...f, partnerId: e.target.value })}><option value="">—</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select></Field>
      <div className="flex items-center gap-2"><Button size="sm" loading={pending} disabled={!f.email || (scoped && !f.partnerId)}>{t("grant")}</Button><Msg /></div>
    </form>
  );
}

export function RevokeRole({ id }: { id: string }) {
  const t = useTranslations("admin.settings.roles");
  const { pending, run } = useRun();
  return <Button size="sm" variant="ghost" loading={pending} onClick={() => run(() => adminRevokeRole(id))}>{t("revoke")}</Button>;
}

export function PageEditor({ slug, locales, initial, canWrite }: { slug: string; locales: string[]; initial: Record<string, { title: string; body: string; reviewed: boolean }>; canWrite: boolean }) {
  const t = useTranslations("admin.content");
  const [loc, setLoc] = useState(locales[0]!);
  const [data, setData] = useState(initial);
  const cur = data[loc] ?? { title: "", body: "", reviewed: false };
  const { pending, run, Msg } = useRun();
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {locales.map((l) => (
          <button key={l} type="button" onClick={() => setLoc(l)} className={cn("rounded-full border px-3 py-1 font-mono text-xs uppercase", loc === l ? "border-midnight-900 bg-midnight-900 text-ivory-50" : "border-[var(--line-strong)]")}>
            {l} <span className={cn("ms-1 inline-block size-1.5 rounded-full align-middle", !data[l]?.title ? "bg-oxblood-600" : data[l]?.reviewed ? "bg-sage-600" : "bg-ochre-600")} />
          </button>
        ))}
      </div>
      <div className="space-y-4" lang={loc} dir={loc === "he" || loc === "yi" ? "rtl" : "ltr"}>
        <Field label={t("pageTitle")} htmlFor={`pt-${slug}`}><Input id={`pt-${slug}`} disabled={!canWrite} value={cur.title} onChange={(e) => setData({ ...data, [loc]: { ...cur, title: e.target.value } })} /></Field>
        <Field label={t("body")} hint={t("bodyHint")} htmlFor={`pb-${slug}`}><Textarea id={`pb-${slug}`} disabled={!canWrite} rows={10} value={cur.body} onChange={(e) => setData({ ...data, [loc]: { ...cur, body: e.target.value } })} /></Field>
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox disabled={!canWrite} checked={cur.reviewed} onChange={(e) => setData({ ...data, [loc]: { ...cur, reviewed: e.target.checked } })} label={t("reviewed")} />
          {canWrite && <Button size="sm" loading={pending} onClick={() => run(() => adminSavePage({ slug, locale: loc, ...cur }))}>{t("save")}</Button>}
          <Msg />
        </div>
      </div>
    </div>
  );
}

export function PartnerForm({ graves }: { graves: Array<{ id: string; name: string }> }) {
  const t = useTranslations("admin.partners");
  const [f, setF] = useState({ name: "", kind: "operator", contactEmail: "", locale: "he", graveIds: [] as string[] });
  const { pending, run, Msg } = useRun();
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => adminSavePartner(f)); }}>
      <Field label={t("name")} htmlFor="pn"><Input id="pn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label={t("kind")} htmlFor="pk"><Select id="pk" value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{["operator", "technician", "institution"].map((k) => <option key={k} value={k}>{t(`kinds.${k}`)}</option>)}</Select></Field>
      <Field label={t("email")} htmlFor="pe"><Input id="pe" dir="ltr" value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} /></Field>
      <Field label={t("locale")} htmlFor="pl"><Select id="pl" value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value })}>{["he", "en", "fr", "ru"].map((l) => <option key={l}>{l}</option>)}</Select></Field>
      <fieldset className="sm:col-span-2"><legend className="mb-2 text-sm font-medium">{t("graves")}</legend><div className="flex flex-wrap gap-3">{graves.map((g) => <Checkbox key={g.id} checked={f.graveIds.includes(g.id)} onChange={(e) => setF({ ...f, graveIds: e.target.checked ? [...f.graveIds, g.id] : f.graveIds.filter((x) => x !== g.id) })} label={g.name} />)}</div></fieldset>
      <div className="flex items-center gap-2"><Button size="sm" loading={pending} disabled={f.name.length < 2}>{t("create")}</Button><Msg /></div>
    </form>
  );
}

export function PartnerScope({ partnerId, graves, selected }: { partnerId: string; graves: Array<{ id: string; name: string }>; selected: string[] }) {
  const t = useTranslations("admin.partners");
  const [sel, setSel] = useState(selected);
  const { pending, run, Msg } = useRun();
  return (
    <div className="flex flex-wrap items-center gap-3">
      {graves.map((g) => <Checkbox key={g.id} checked={sel.includes(g.id)} onChange={(e) => setSel(e.target.checked ? [...sel, g.id] : sel.filter((x) => x !== g.id))} label={g.name} />)}
      <Button size="sm" variant="outline" loading={pending} onClick={() => run(() => adminSetPartnerGraves(partnerId, sel))}>{t("saveScope")}</Button>
      <Msg />
    </div>
  );
}

export function AnonymizeButton({ email }: { email: string }) {
  const t = useTranslations("admin.customers");
  const tc = useTranslations("admin.common");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { pending, run, Msg } = useRun();
  return (
    <>
      <Button size="sm" variant="ghost" className="text-oxblood-600" onClick={() => setOpen(true)}>{t("anonymize")}</Button>
      <Msg />
      <Modal open={open} onOpenChange={setOpen} title={t("anonymizeTitle")} description={t("anonymizeBody")} footer={<Button variant="danger" loading={pending} disabled={reason.trim().length < 4} onClick={() => { run(() => adminAnonymizeCustomer(email, reason)); setOpen(false); }}>{t("anonymize")}</Button>}>
        <Field label={tc("reason")} hint={tc("reasonHint")} htmlFor="ar"><Textarea id="ar" rows={3} className="min-h-0" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </>
  );
}

export function Tabs({ tabs, current, base }: { tabs: Array<{ key: string; label: ReactNode }>; current: string; base: string }) {
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-[var(--line)]">
      {tabs.map((t) => (
        <a key={t.key} href={`${base}?tab=${t.key}`} aria-current={current === t.key ? "page" : undefined} className={cn("-mb-px border-b-2 px-4 py-2.5 text-sm", current === t.key ? "border-gold-500 font-semibold text-midnight-900" : "border-transparent text-charcoal-500 hover:text-midnight-900")}>{t.label}</a>
      ))}
    </div>
  );
}
