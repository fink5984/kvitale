"use client";

import { Lock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { checkout } from "@/app/actions/public";
import type { BuilderGrave } from "@/components/builder/Builder";
import { Button, Checkbox, DemoBadge, EmptyState, Field, Input, Notice, Skeleton, Stepper, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { formatDateTime } from "@/lib/format";
import { store, useStore } from "@/lib/store";
import { Summary, useQuote } from "./CartView";

export function CheckoutView({ graves, currency, sessionEmail, demo }: { graves: BuilderGrave[]; currency: string; sessionEmail: string | null; demo: boolean }) {
  const t = useTranslations("commerce.checkout");
  const ts = useTranslations("builder.steps");
  const locale = useLocale();
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
  useEffect(() => setMounted(true), []);
  const { quote, error: qError } = useQuote(cart, currency, appliedCoupon);
  const bySlug = useMemo(() => Object.fromEntries(graves.map((g) => [g.slug, g])), [graves]);
  const scheduled = [...new Set(cart.flatMap((e) => e.graveSlugs))].map((s) => bySlug[s]).filter((g): g is BuilderGrave => !!g && g.availability.kind === "scheduled");
  const needsScheduleConsent = scheduled.some((g) => g.availability.reason === "maintenance" || g.availability.reason === "device_offline");

  if (!mounted) return <div className="mx-auto max-w-5xl px-[var(--gutter)] py-16"><Skeleton className="h-96" /></div>;
  if (!cart.length)
    return (
      <div className="mx-auto max-w-3xl px-[var(--gutter)] py-20">
        <EmptyState title={t("empty")} action={<Link href="/write" className={buttonClass("primary", "md")}>{t("emptyCta")}</Link>} />
      </div>
    );

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const hp = (new FormData(e.currentTarget).get("website") as string) ?? "";
    start(async () => {
      const r = await checkout({ entries: cart, email, currency, coupon: appliedCoupon, marketingConsent: marketing, acceptTerms: terms, acceptSchedule: schedule, locale, website: hp });
      if (!r.ok) {
        setError(t(`errors.${r.error}`, { detail: r.detail ?? "" }));
        return;
      }
      store.clearCart();
      window.location.assign(r.redirectUrl);
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-[var(--gutter)] pb-28 pt-8">
      <Stepper steps={[ts("choose"), ts("write"), ts("preview"), ts("pay"), ts("track")]} current={3} label={ts("label")} />
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_22rem]">
        <form onSubmit={submit} className="space-y-6" noValidate>
          <div>
            <h1 className="font-display text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[1.02] text-midnight-900">{t("title")}</h1>
            <p className="mt-3 text-charcoal-600">{t("intro")}</p>
          </div>
          <section className="space-y-5 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-soft">
            <Field label={t("email")} hint={t("emailHint")} htmlFor="email">
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" />
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

          <section className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-soft">
            <Checkbox checked={terms} onChange={(e) => setTerms(e.target.checked)} required label={<>{t.rich("terms", { terms: (c) => <Link href="/legal/terms" className="underline">{c}</Link>, disclosure: (c) => <Link href="/legal/delivery-disclosure" className="underline">{c}</Link> })}</>} />
            <Checkbox checked={marketing} onChange={(e) => setMarketing(e.target.checked)} label={t("marketing")} description={t("marketingHint")} />
          </section>

          {error && <Notice tone="warning">{error}</Notice>}

          <div className="rounded-xl bg-midnight-900 p-5 text-ivory-50">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="flex items-center gap-2 text-sm text-ivory-100/75">
                <Lock className="size-4 text-gold-300" /> {t("secure")} {demo && <DemoBadge label={t("demoProvider")} />}
              </p>
              <Button type="submit" variant="gold" size="lg" loading={pending} disabled={!terms || !email || !quote || (needsScheduleConsent && !schedule)}>
                {t("pay")}
              </Button>
            </div>
          </div>
        </form>
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <Summary quote={quote} error={qError} />
          <ul className="mt-4 space-y-1 text-sm text-charcoal-600">
            {quote?.lines.map((l) => (
              <li key={`${l.entryId}-${l.graveSlug}`} className="flex justify-between gap-3">
                <bdi className="truncate">{bySlug[l.graveSlug]?.name}</bdi>
                <span className="shrink-0 text-charcoal-500">{t("pages", { count: l.pages })}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
