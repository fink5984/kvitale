import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, DemoBadge } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn, countryName, formatDate, formatMoney, hebrewDate } from "@/lib/format";
import type { GraveCardData } from "@/server/graves";

export function availabilityTone(a: GraveCardData["availability"]): "success" | "warning" | "neutral" | "info" | "danger" {
  if (a.kind === "available_now") return "success";
  if (a.kind === "scheduled") return a.reason === "maintenance" || a.reason === "device_offline" ? "warning" : "info";
  return a.reason === "paused" ? "danger" : "neutral";
}

export function AvailabilityBadge({ a, className }: { a: GraveCardData["availability"]; className?: string }) {
  const t = useTranslations("status.availability");
  const key = a.kind === "available_now" ? "available_now" : a.reason;
  return (
    <Badge tone={availabilityTone(a)} dot={a.kind === "available_now"} className={className}>
      {t(key)}
    </Badge>
  );
}

/**
 * The "typographic portrait": no stock photography, no fabricated tombstones.
 * The tzaddik's Hebrew name is set inside a limestone arch — dignified, honest,
 * and consistent across hundreds of graves until licensed photos exist.
 */
export function GravePortrait({ nameHe, size = "md", className, photo, eager }: { nameHe: string; size?: "sm" | "md" | "lg"; className?: string; photo?: GraveCardData["cover"]; eager?: boolean }) {
  if (photo) return <GravePhoto nameHe={nameHe} photo={photo} className={className} eager={eager} />;
  const words = nameHe.split(" ");
  const lines = words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")] : [nameHe];
  return (
    <div className={cn("tex-stone relative isolate overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_50%_100%,rgb(179_141_72/0.16),transparent_70%)]" aria-hidden />
      <svg viewBox="0 0 200 250" preserveAspectRatio="none" className="absolute inset-0 h-full w-full text-gold-500/70" aria-hidden>
        <path d="M24 250V104C24 54 58 18 100 10c42 8 76 44 76 94v146" fill="none" stroke="currentColor" strokeWidth=".9" vectorEffect="non-scaling-stroke" />
        <path d="M36 250V108c0-42 28-73 64-80 36 7 64 38 64 80v142" fill="none" stroke="currentColor" strokeWidth=".6" opacity=".55" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative flex h-full flex-col items-center justify-center px-[14%] pt-[12%] text-center" dir="rtl" lang="he">
        <svg viewBox="0 0 24 12" className="mb-3 h-2.5 w-5 text-gold-500" fill="currentColor" aria-hidden>
          <path d="M12 0l3 6-3 6-3-6z" />
        </svg>
        {lines.map((l, i) => (
          <span key={i} className={cn("hebrew-name block leading-[1.12] text-midnight-900", size === "lg" ? "text-[clamp(2rem,4vw,3.4rem)]" : size === "sm" ? "text-[1.35rem]" : "text-[clamp(1.55rem,2.3vw,2.1rem)]", i === 0 && lines.length > 1 && "text-charcoal-700 [font-size:0.72em]")}>
            {l}
          </span>
        ))}
        <span className="mt-4 h-px w-10 bg-gold-500/60" aria-hidden />
      </div>
    </div>
  );
}

/** A licensed, rights-verified photo of the tziyun, framed in the same arch as the portrait. */
function GravePhoto({ nameHe, photo, className, eager }: { nameHe: string; photo: NonNullable<GraveCardData["cover"]>; className?: string; eager?: boolean }) {
  return (
    <div className={cn("relative isolate overflow-hidden bg-midnight-900", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- served from our own media route with explicit cache headers */}
      <img
        src={`/api/media/grave/${photo.id}`}
        alt={photo.alt ?? nameHe}
        width={photo.width ?? undefined}
        height={photo.height ?? undefined}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(13_20_36/0.55),transparent_45%)]" aria-hidden />
      <div className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-gold-300/25" aria-hidden />
    </div>
  );
}

export function GraveCard({ g, locale, priority }: { g: GraveCardData; locale: string; priority?: boolean }) {
  const t = useTranslations("public.card");
  const purchasable = g.availability.kind !== "not_purchasable";
  return (
    <article className="group relative flex flex-col" data-priority={priority || undefined}>
      <Link href={`/graves/${g.slug}`} className="relative block overflow-hidden rounded-t-[999px] rounded-b-md shadow-soft ring-1 ring-stone-300/60 transition-[box-shadow,transform] duration-500 ease-[var(--ease-out-soft)] group-hover:-translate-y-1 group-hover:shadow-lift" aria-label={g.name}>
        <GravePortrait nameHe={g.nameHe} photo={g.cover} eager={priority} className="aspect-[4/5] w-full" />
        <div className="absolute inset-x-3 top-[18%] flex justify-center opacity-0 transition-opacity duration-500 group-hover:opacity-100" aria-hidden>
          <span className="h-24 w-24 rounded-full bg-gold-300/30 blur-2xl" />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
          <AvailabilityBadge a={g.availability} className="backdrop-blur-sm" />
          {g.isDemo && <DemoBadge />}
        </div>
      </Link>
      <div className="flex flex-1 flex-col px-1 pt-4">
        <h3 className="font-display text-[1.45rem] leading-tight text-midnight-900">
          <Link href={`/graves/${g.slug}`} className="after:absolute after:inset-0 after:content-['']">
            <bdi>{g.name}</bdi>
          </Link>
        </h3>
        {g.epithet && <p className="mt-1 line-clamp-1 text-sm text-charcoal-500">{g.epithet}</p>}
        <dl className="mt-3 space-y-1.5 text-[0.84rem] text-charcoal-600">
          <div className="flex items-center gap-2">
            <dt className="sr-only">{t("location")}</dt>
            <MapPin className="size-3.5 shrink-0 text-gold-600" strokeWidth={1.5} aria-hidden />
            <dd className="truncate">{g.place ?? countryName(g.countryCode, locale)}</dd>
          </div>
          {g.hilula && (
            <div className="flex items-center gap-2">
              <dt className="sr-only">{t("hilula")}</dt>
              <CalendarDays className="size-3.5 shrink-0 text-gold-600" strokeWidth={1.5} aria-hidden />
              <dd className="truncate">
                {t("hilulaOn", { date: hebrewDate(g.hilula.date, locale) })} · <span className="text-charcoal-500">{formatDate(g.hilula.date, locale)}</span>
              </dd>
            </div>
          )}
        </dl>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          {purchasable && g.fromPrice ? (
            <p className="text-sm text-charcoal-500">
              {t("from")} <span className="font-display text-xl text-midnight-900 tabular">{formatMoney(g.fromPrice.amountMinor, g.fromPrice.currency, locale)}</span>
            </p>
          ) : (
            <p className="text-sm text-charcoal-500">{t("notPurchasable")}</p>
          )}
          <span className="relative z-10 inline-flex items-center gap-1 text-sm font-medium text-midnight-900 transition-colors group-hover:text-gold-600">
            {purchasable ? t("write") : t("details")}
            <ArrowUpRight className="flip-rtl size-4" strokeWidth={1.5} aria-hidden />
          </span>
        </div>
      </div>
    </article>
  );
}

export function GraveCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="skeleton aspect-[4/5] rounded-t-[999px] rounded-b-md" />
      <div className="skeleton mt-4 h-6 w-3/4 rounded" />
      <div className="skeleton mt-2 h-4 w-1/2 rounded" />
    </div>
  );
}
