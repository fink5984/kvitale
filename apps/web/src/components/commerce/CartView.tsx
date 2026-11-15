"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import type { KvittelContent } from "@kvittel/print-layout";
import { quoteCart } from "@/app/actions/public";
import type { BuilderGrave } from "@/components/builder/Builder";
import { PaperSlips, usePreviewLayout } from "@/components/builder/KvittelPreview";
import { Button, EmptyState, Notice, Skeleton, Stepper, buttonClass } from "@/components/ui";
import { Link, useRouter } from "@/i18n/navigation";
import type { CartEntry } from "@/lib/kvittel-schema";
import { formatMoney } from "@/lib/format";
import { store, useStore } from "@/lib/store";
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

export function CartView({ graves, currency }: { graves: BuilderGrave[]; currency: string }) {
  const t = useTranslations("commerce.cart");
  const ts = useTranslations("builder.steps");
  const locale = useLocale();
  const router = useRouter();
  const cart = useStore((s) => s.cart);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const bySlug = useMemo(() => Object.fromEntries(graves.map((g) => [g.slug, g])), [graves]);
  const { quote, error } = useQuote(cart, currency);

  if (!mounted)
    return (
      <div className="mx-auto max-w-5xl px-[var(--gutter)] py-16">
        <Skeleton className="h-64" />
      </div>
    );

  const steps = [ts("choose"), ts("write"), ts("preview"), ts("pay"), ts("track")];
  return (
    <div className="mx-auto max-w-6xl px-[var(--gutter)] pb-28 pt-8">
      <Stepper steps={steps} current={2} label={ts("label")} />
      <h1 className="font-display mt-8 text-[clamp(2.2rem,4.4vw,3.4rem)] leading-[1.02] text-midnight-900">{t("title")}</h1>
      {cart.length === 0 ? (
        <div className="mt-10">
          <EmptyState title={t("empty.title")} body={t("empty.body")} action={<Link href="/write" className={buttonClass("primary", "md")}>{t("empty.cta")}</Link>} />
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_22rem]">
          <ul className="space-y-6">
            {cart.map((e, i) => (
              <li key={e.id} className="grid gap-6 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-soft sm:grid-cols-[9rem_1fr] sm:p-6">
                <MiniPreview content={e.content as KvittelContent} />
                <div className="min-w-0">
                  <p className="eyebrow text-gold-700">{t("kvittel", { n: i + 1 })}</p>
                  <ul className="mt-3 space-y-2">
                    {e.graveSlugs.map((s) => {
                      const line = quote?.lines.find((l) => l.entryId === e.id && l.graveSlug === s);
                      return (
                        <li key={s} className="flex items-baseline justify-between gap-4 border-b border-[var(--line)] pb-2">
                          <span className="font-display text-xl text-midnight-900">
                            <bdi>{bySlug[s]?.name ?? s}</bdi>
                          </span>
                          <span className="text-sm tabular text-charcoal-700">{line ? formatMoney(line.unitMinor + line.extrasMinor, quote!.currency, locale) : "…"}</span>
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-3 text-sm text-charcoal-500">{t("summary", { people: e.content.people.filter((p) => (p.mode === "free" ? p.freeText : p.given)?.trim()).length, chars: e.content.request.length })}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Pencil className="size-3.5" />}
                      onClick={() => {
                        store.setDraft({ graveSlugs: e.graveSlugs, content: e.content, editingEntryId: e.id });
                        router.push("/write");
                      }}
                    >
                      {t("edit")}
                    </Button>
                    <Button variant="ghost" size="sm" icon={<Trash2 className="size-3.5" />} onClick={() => store.removeFromCart(e.id)}>
                      {t("remove")}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
            <li>
              <Link href="/write" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-stone-400 py-6 text-sm font-medium text-midnight-900 hover:border-gold-500" onClick={() => store.setDraft(null)}>
                <Plus className="size-4" /> {t("addAnother")}
              </Link>
            </li>
          </ul>
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <Summary quote={quote} error={error} />
            <Link href="/checkout" className={buttonClass("primary", "lg", "mt-5 w-full")} aria-disabled={!quote}>
              {t("checkout")}
            </Link>
            <p className="mt-3 text-center text-xs text-charcoal-500">{t("noAccount")}</p>
          </aside>
        </div>
      )}
    </div>
  );
}

export function Summary({ quote, error }: { quote: Quote | null; error: string | null }) {
  const t = useTranslations("commerce.summary");
  const locale = useLocale();
  if (error) return <Notice tone="warning">{t("error")}</Notice>;
  if (!quote) return <Skeleton className="h-48 rounded-xl" />;
  const m = (v: number) => formatMoney(v, quote.currency, locale);
  return (
    <div className="rounded-xl bg-midnight-900 p-6 text-ivory-50 shadow-lift">
      <h2 className="font-display text-2xl">{t("title")}</h2>
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
              {t("coupon")} <bdi className="font-mono">{quote.coupon?.code}</bdi>
            </dt>
            <dd className="tabular">−{m(quote.couponDiscountMinor)}</dd>
          </div>
        )}
      </dl>
      <div className="mt-5 flex items-baseline justify-between border-t border-ivory-50/15 pt-5">
        <span className="text-ivory-100/80">{t("total")}</span>
        <span className="font-display text-3xl tabular">{m(quote.totalMinor)}</span>
      </div>
      <p className="mt-3 text-xs text-ivory-100/50">{t("taxNote")}</p>
    </div>
  );
}

function MiniPreview({ content }: { content: KvittelContent }) {
  const opts = useMemo(() => ({ reference: "KV·PREVIEW" }), []);
  const { layout } = usePreviewLayout(content, opts);
  return <div className="tex-stone grid place-items-start justify-center overflow-hidden rounded-t-[5rem] rounded-b-md px-4 pt-8 ring-1 ring-stone-300 max-h-56">{layout ? <PaperSlips layout={layout} maxPages={1} className="w-28 [&_figure]:max-w-none" /> : <Skeleton className="h-40 w-28" />}</div>;
}
