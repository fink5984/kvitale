"use client";

import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { KvittelContent } from "@kvittel/print-layout";
import { checkout, quoteCart } from "@/app/actions/public";
import { PaperSlips, usePreviewLayout } from "@/components/builder/KvittelPreview";
import { CurrencyMenu } from "@/components/site/Header";
import { Button, Checkbox, DemoBadge, EmptyState, Field, Input, Notice, Skeleton, buttonClass } from "@/components/ui";
import type { BuilderGrave } from "@/components/write/types";
import { Link, useRouter } from "@/i18n/navigation";
import type { CartEntry } from "@/lib/kvittel-schema";
import { formatDateTime, formatMoney } from "@/lib/format";
import { newId, store, useStore } from "@/lib/store";
import type { Quote } from "@/server/pricing";

export function useQuote(entries: CartEntry[], currency: string, coupon?: string) {
  const [q, setQ] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify([entries.map((e) => [e.id, e.graveSlugs, e.content]), currency, coupon]);
  useEffect(() => {
    if (!entries.length) return;
    let alive = true;
    setError(null);
    const tm = setTimeout(async () => {
      const r = await quoteCart({ entries, currency, coupon });
      if (!alive) return;
      if (r.ok) setQ(r.quote as Quote);
      else setError(r.error);
    }, 200);
    return () => {
      alive = false;
      clearTimeout(tm);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { quote: q, error };
}

/**
 * One screen: what is being sent, the final price, and payment. This is the first place a price appears.
 * Nothing the person typed is ever asked for again.
 */
export function CheckoutView({ graves, currency, sessionEmail, demo, available }: { graves: BuilderGrave[]; currency: string; sessionEmail: string | null; demo: boolean; available: boolean }) {
  const t = useTranslations("commerce.checkout");
  const tc = useTranslations("commerce.cart");
  const locale = useLocale();
  const router = useRouter();
  const cart = useStore((s) => s.cart);
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState(sessionEmail ?? "");
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | undefined>();
  const [marketing, setMarketing] = useState(false);
  const [terms, setTerms] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submitting = useRef(false);
  const idem = useRef(`ik_${newId()}`);
  useEffect(() => setMounted(true), []);
  const { quote, error: qError } = useQuote(cart, currency, appliedCoupon);
  // A different basket / currency / coupon is a different payment attempt.
  const attemptKey = JSON.stringify([cart.map((e) => [e.id, e.graveSlugs, e.content]), currency, appliedCoupon, email.trim().toLowerCase()]);
  useEffect(() => {
    idem.current = `ik_${newId()}`;
  }, [attemptKey]);
  const bySlug = useMemo(() => Object.fromEntries(graves.map((g) => [g.slug, g])), [graves]);
  const scheduled = [...new Set(cart.flatMap((e) => e.graveSlugs))].map((s) => bySlug[s]).filter((g): g is BuilderGrave => !!g && g.availability.kind === "scheduled");
  const needsScheduleConsent = scheduled.some((g) => g.availability.reason === "maintenance" || g.availability.reason === "device_offline");
  const unsendable = cart.flatMap((e) => e.graveSlugs).filter((s) => bySlug[s]?.availability.kind === "not_purchasable");

  if (!mounted)
    return (
      <div className="mx-auto max-w-5xl px-[var(--gutter)] py-16">
        <Skeleton className="h-96" />
      </div>
    );
  if (!cart.length)
    return (
      <div className="mx-auto max-w-3xl px-[var(--gutter)] py-20">
        <EmptyState title={t("empty")} action={<Link href="/graves" className={buttonClass("primary", "md")}>{t("emptyCta")}</Link>} />
      </div>
    );

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting.current) return; // one click = one order, even on double-tap
    submitting.current = true;
    setError(null);
    const hp = (new FormData(e.currentTarget).get("website") as string) ?? "";
    start(async () => {
      try {
        const r = await checkout({ entries: cart, email, currency, coupon: appliedCoupon, marketingConsent: marketing, acceptTerms: terms, acceptSchedule: schedule, locale, website: hp, idempotencyKey: idem.current });
        if (!r.ok) {
          setError(t(`errors.${r.error}`, { detail: r.detail ?? "" }));
          submitting.current = false;
          return;
        }
        // The basket is kept until the order page confirms payment, so an abandoned payment can be resumed.
        window.location.assign(r.redirectUrl);
      } catch {
        setError(t("errors.server_error"));
        submitting.current = false;
      }
    });
  };

  const m = (v: number) => (quote ? formatMoney(v, quote.currency, locale) : "…");
  return (
    <div className="mx-auto max-w-6xl px-[var(--gutter)] pb-28 pt-8 sm:pt-12">
      <h1 className="font-display text-[clamp(2rem,4.6vw,3.2rem)] font-medium leading-[1.05] text-midnight-900">{t("title")}</h1>
      <p className="mt-2 text-charcoal-600">{t("intro")}</p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_23rem]">
        <div className="space-y-8">
          {/* what is being sent */}
          <ul className="space-y-5">
            {cart.map((e, i) => (
              <li key={e.id} className="grid gap-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft sm:grid-cols-[8.5rem_1fr] sm:p-6">
                <MiniNote content={e.content as KvittelContent} />
                <div className="min-w-0">
                  <p className="eyebrow text-gold-700">{tc("kvittel", { n: i + 1 })}</p>
                  <ul className="mt-2 space-y-1.5">
                    {e.graveSlugs.map((s) => {
                      const line = quote?.lines.find((l) => l.entryId === e.id && l.graveSlug === s);
                      return (
                        <li key={s} className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] pb-1.5">
                          <span className="font-display text-xl text-midnight-900">
                            <bdi>{bySlug[s]?.name ?? s}</bdi>
                          </span>
                          <span className="text-sm tabular text-charcoal-700">{line ? m(line.unitMinor + line.extrasMinor) : "…"}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 line-clamp-2 text-sm text-charcoal-500" dir="auto">
                    {[...e.content.people.map((p) => p.freeText || p.given).filter(Boolean), e.content.request].join(" · ")}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Pencil className="size-3.5" />}
                      onClick={() => {
                        store.setDraft({ graveSlugs: e.graveSlugs, content: e.content, editingEntryId: e.id });
                        router.push(`/graves/${e.graveSlugs[0]}`);
                      }}
                    >
                      {tc("edit")}
                    </Button>
                    <Button variant="ghost" size="sm" icon={<Trash2 className="size-3.5" />} onClick={() => store.removeFromCart(e.id)}>
                      {tc("remove")}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
            <li>
              <Link href="/graves" className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-stone-400 py-5 text-sm font-medium text-midnight-900 hover:border-gold-500" onClick={() => store.setDraft(null)}>
                <Plus className="size-4" /> {tc("addAnother")}
              </Link>
            </li>
          </ul>

          <form onSubmit={submit} className="space-y-6" noValidate id="pay-form">
            <section className="space-y-5 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-soft">
              <Field label={t("email")} hint={t("emailHint")} htmlFor="email">
                <Input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
              </Field>
              {/* honeypot */}
              <div aria-hidden className="absolute -start-[9999px] h-0 overflow-hidden">
                <label>
                  Website <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <Field label={t("coupon")} htmlFor="coupon" optional={t("optional")}>
                <div className="flex gap-2">
                  <Input id="coupon" value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} className="uppercase" dir="ltr" />
                  <Button type="button" variant="outline" onClick={() => setAppliedCoupon(coupon.trim() || undefined)}>
                    {t("apply")}
                  </Button>
                </div>
              </Field>
              {appliedCoupon && quote?.couponError && <Notice tone="warning">{t(`couponErrors.${quote.couponError}`)}</Notice>}
            </section>

            {scheduled.length > 0 && (
              <Notice tone="warning" title={t("scheduled.title")}>
                <ul className="mt-1 list-disc ps-5">
                  {scheduled.map((g) => (
                    <li key={g.slug}>
                      <bdi>{g.name}</bdi> — {t(`scheduled.${g.availability.reason}`, { when: g.availability.nextOpenAt ? formatDateTime(g.availability.nextOpenAt, locale) : "—" })}
                    </li>
                  ))}
                </ul>
                {needsScheduleConsent && <Checkbox className="mt-3" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} label={t("scheduled.consent")} />}
              </Notice>
            )}

            <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-soft">
              <Checkbox checked={terms} onChange={(e) => setTerms(e.target.checked)} required label={<>{t.rich("terms", { terms: (c) => <Link href="/legal/terms" className="underline">{c}</Link>, disclosure: (c) => <Link href="/legal/delivery-disclosure" className="underline">{c}</Link> })}</>} />
              <Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)} label={t("marketing")} description={t("marketingHint")} />
            </section>

            {!available && <Notice tone="warning">{t("unavailable")}</Notice>}
            {unsendable.length > 0 && available && <Notice tone="warning">{t("errors.grave_unavailable", { detail: "" })}</Notice>}
            {error && (
              <Notice tone="warning">
                <span role="alert">{error}</span>
              </Notice>
            )}
          </form>
        </div>

        {/* the price — first and final */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl bg-midnight-900 p-6 text-ivory-50 shadow-lift">
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-display text-2xl">{t("summaryTitle")}</h2>
              <CurrencyMenu dark currency={currency} />
            </div>
            {qError ? (
              <Notice tone="warning" className="mt-4">
                {t("quoteError")}
              </Notice>
            ) : !quote ? (
              <Skeleton className="mt-5 h-28 rounded-xl" />
            ) : (
              <>
                <dl className="mt-5 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ivory-100/70">{t("deliveries", { count: quote.lines.length })}</dt>
                    <dd className="tabular">{m(quote.subtotalMinor)}</dd>
                  </div>
                  {quote.lines.some((l) => l.extrasMinor > 0) && (
                    <div className="flex justify-between gap-4 text-ivory-100/60">
                      <dt>{t("extraPages")}</dt>
                      <dd className="tabular">{m(quote.lines.reduce((s, l) => s + l.extrasMinor, 0))}</dd>
                    </div>
                  )}
                  {quote.bundleDiscountMinor > 0 && (
                    <div className="flex justify-between gap-4 text-gold-200">
                      <dt>{t("bundle", { pct: quote.bundleBps / 100 })}</dt>
                      <dd className="tabular">−{m(quote.bundleDiscountMinor)}</dd>
                    </div>
                  )}
                  {quote.couponDiscountMinor > 0 && (
                    <div className="flex justify-between gap-4 text-gold-200">
                      <dt>
                        {t("couponLine")} <bdi className="font-mono">{quote.coupon?.code}</bdi>
                      </dt>
                      <dd className="tabular">−{m(quote.couponDiscountMinor)}</dd>
                    </div>
                  )}
                </dl>
                <div className="mt-5 flex items-baseline justify-between border-t border-ivory-50/15 pt-5">
                  <span className="text-ivory-100/80">{t("total")}</span>
                  <span className="font-display text-4xl tabular">{m(quote.totalMinor)}</span>
                </div>
                <p className="mt-2 text-xs text-ivory-100/55">{t("taxNote")}</p>
              </>
            )}
            <Button type="submit" form="pay-form" variant="gold" size="xl" className="mt-6 w-full" loading={pending} disabled={!available || unsendable.length > 0 || !terms || !email || !quote || (needsScheduleConsent && !schedule)}>
              {t("pay")}
            </Button>
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-ivory-100/65">
              <Lock className="size-3.5 text-gold-300" /> {t("secure")} {demo && <DemoBadge label={t("demoProvider")} />}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function MiniNote({ content }: { content: KvittelContent }) {
  const opts = useMemo(() => ({ reference: "KV·PREVIEW" }), []);
  const { layout } = usePreviewLayout(content, opts);
  return <div className="max-h-52 overflow-hidden rounded-md bg-ivory-200/70 px-3 pt-3 ring-1 ring-stone-300/70">{layout ? <PaperSlips layout={layout} maxPages={1} className="w-28 [&_figure]:max-w-none" /> : <Skeleton className="h-40 w-28" />}</div>;
}
