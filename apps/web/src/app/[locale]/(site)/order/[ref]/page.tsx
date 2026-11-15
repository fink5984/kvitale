import { Check, Clock, ShieldAlert } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AutoRefresh } from "@/components/commerce/AutoRefresh";
import { Badge, DemoBadge, Notice, Ornament, buttonClass } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn, formatDateTime, formatMoney } from "@/lib/format";
import { getSession } from "@/server/auth/session";
import { getOrderView, orderIdByRef, resolveTrackingAccess } from "@/server/orders";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

const TERMINAL = new Set(["delivered", "refunded", "failed", "canceled"]);

export default async function OrderPage({ params, searchParams }: { params: Promise<{ locale: string; ref: string }>; searchParams: Promise<{ t?: string }> }) {
  const { locale, ref } = await params;
  setRequestLocale(locale);
  const { t: token } = await searchParams;
  const t = await getTranslations("commerce.order");
  const ts = await getTranslations("status.item");

  let orderId = await resolveTrackingAccess(ref, token);
  if (!orderId) {
    const s = await getSession();
    const o = await orderIdByRef(ref);
    if (s && o && o.userId === s.id) orderId = o.id;
  }
  if (!orderId)
    return (
      <div className="mx-auto max-w-xl px-[var(--gutter)] py-24 text-center">
        <ShieldAlert className="mx-auto size-10 text-gold-600" strokeWidth={1.3} />
        <h1 className="font-display mt-6 text-4xl text-midnight-900">{t("locked.title")}</h1>
        <p className="mt-4 text-charcoal-600">{t("locked.body")}</p>
        <Link href={`/login?next=${encodeURIComponent(`/order/${ref}`)}`} className={buttonClass("outline", "md", "mt-8")}>
          {t("locked.signIn")}
        </Link>
      </div>
    );

  const o = (await getOrderView(orderId, locale))!;
  const live = o.paymentStatus !== "failed" && o.items.some((i) => !TERMINAL.has(i.status) && i.status !== "uncertain");

  return (
    <div className="pb-28">
      <AutoRefresh active={live} intervalMs={4000} />
      <section className="tex-night text-ivory-50">
        <div className="mx-auto max-w-5xl px-[var(--gutter)] py-14 sm:py-20">
          <div className="flex flex-wrap items-center gap-3">
            <p className="eyebrow text-gold-300">{t("eyebrow")}</p>
            {o.isDemo && <DemoBadge />}
          </div>
          <h1 className="font-display mt-4 text-[clamp(2.4rem,5vw,4rem)] leading-[1.02]">{o.paymentStatus === "succeeded" ? t("titlePaid") : o.paymentStatus === "failed" ? t("titleFailed") : t("titlePending")}</h1>
          <p className="mt-4 max-w-2xl text-ivory-100/70">{o.paymentStatus === "succeeded" ? t("bodyPaid") : o.paymentStatus === "failed" ? t("bodyFailed") : t("bodyPending")}</p>
          <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4 text-sm">
            <div>
              <dt className="text-ivory-100/50">{t("ref")}</dt>
              <dd className="mt-1 font-mono text-lg">
                <bdi>{o.ref}</bdi>
              </dd>
            </div>
            <div>
              <dt className="text-ivory-100/50">{t("total")}</dt>
              <dd className="mt-1 font-display text-2xl tabular">{formatMoney(o.totalMinor, o.currency, locale)}</dd>
            </div>
            <div>
              <dt className="text-ivory-100/50">{t("placed")}</dt>
              <dd className="mt-1">{formatDateTime(o.createdAt, locale)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <div className="mx-auto max-w-5xl space-y-8 px-[var(--gutter)] pt-12">
        {o.paymentStatus === "created" && <Notice tone="info">{t("webhookNote")}</Notice>}
        {o.items.map((it) => (
          <section key={it.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-soft sm:p-8" aria-labelledby={`item-${it.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 id={`item-${it.id}`} className="font-display text-3xl text-midnight-900">
                  <bdi>{it.graveName}</bdi>
                </h2>
                <p className="mt-1 text-sm text-charcoal-500">
                  {t("localTime", { tz: it.timezone, time: formatDateTime(new Date(), locale, it.timezone, { hour: "2-digit", minute: "2-digit", weekday: "short" }) })}
                </p>
              </div>
              <Badge tone={it.status === "delivered" ? "success" : it.status === "uncertain" || it.status === "failed" ? "danger" : it.status === "scheduled" ? "info" : "gold"} dot={it.status === "delivered"}>
                {ts(it.status)}
              </Badge>
            </div>
            {it.status === "scheduled" && it.scheduledFor && <Notice tone="info" className="mt-5">{t("scheduledFor", { when: formatDateTime(it.scheduledFor, locale, it.timezone) })}</Notice>}
            {it.status === "uncertain" && <Notice tone="warning" className="mt-5" title={t("uncertain.title")}>{t("uncertain.body")}</Notice>}
            <ol className="mt-8 grid gap-0 sm:grid-cols-8">
              {it.timeline.map((s, i) => (
                <li key={s.key + i} className="relative flex gap-4 pb-6 sm:flex-col sm:items-center sm:gap-3 sm:pb-0 sm:text-center">
                  {i < it.timeline.length - 1 && <span className={cn("absolute start-[0.6875rem] top-6 h-full w-px sm:start-1/2 sm:top-[0.6875rem] sm:h-px sm:w-full", s.state === "done" ? "bg-gold-500" : "bg-stone-300")} aria-hidden />}
                  <span className={cn("relative z-10 grid size-6 shrink-0 place-items-center rounded-full text-[0.65rem]", s.state === "done" && "bg-midnight-900 text-gold-300", s.state === "current" && "bg-gold-400 text-midnight-950 shadow-glow", s.state === "upcoming" && "border border-stone-300 bg-ivory-50", s.state === "problem" && "bg-oxblood-600 text-ivory-50")}>
                    {s.state === "done" ? <Check className="size-3.5" /> : s.state === "current" ? <Clock className="size-3.5 animate-pulse" /> : s.state === "problem" ? "!" : ""}
                  </span>
                  <div className="min-w-0">
                    <p className={cn("text-sm", s.state === "upcoming" ? "text-charcoal-500" : "font-medium text-midnight-900")}>{ts(s.key)}</p>
                    {s.at && <p className="text-[0.72rem] text-charcoal-500 tabular">{formatDateTime(s.at, locale, it.timezone, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</p>}
                  </div>
                </li>
              ))}
            </ol>
            {it.status === "delivered" && (
              <p className="mt-6 text-sm text-charcoal-600">
                {t(`confidence.${it.confidence ?? "printer_reported"}`)}
              </p>
            )}
          </section>
        ))}
        <p className="text-center text-sm text-charcoal-500">{t("privacy")}</p>
        <Ornament />
      </div>
    </div>
  );
}
