import { ArrowUpRight, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { cn, countryName } from "@/lib/format";
import type { GraveCardData } from "@/server/graves";
import { PhotoFallback, TziyunPhoto } from "./Photo";

export function availabilityTone(a: GraveCardData["availability"]): "success" | "warning" | "neutral" | "info" | "danger" {
  if (a.kind === "available_now") return "success";
  if (a.kind === "scheduled") return a.reason === "maintenance" || a.reason === "device_offline" ? "warning" : "info";
  return a.reason === "paused" ? "danger" : "neutral";
}

/** Photograph-led card. No price, no statistics: the tzaddik, the place, and one clear action. */
export function GraveCard({ g, locale, priority, tall, sizes = "(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" }: { g: GraveCardData; locale: string; priority?: boolean; tall?: boolean; sizes?: string }) {
  const t = useTranslations("site.card");
  const ta = useTranslations("status.availability");
  const sendable = g.availability.kind !== "not_purchasable";
  return (
    <article className="group relative">
      <Link href={`/graves/${g.slug}`} className="relative block overflow-hidden rounded-[1.1rem] bg-midnight-900 shadow-soft ring-1 ring-stone-300/50 transition-[box-shadow,transform] duration-500 ease-[var(--ease-out-soft)] hover:-translate-y-0.5 hover:shadow-lift" aria-label={g.name}>
        <div className={cn("relative w-full", tall ? "aspect-[4/5] sm:aspect-[3/4]" : "aspect-[4/5]")}>
          {g.cover ? <TziyunPhoto image={g.cover} mobile={g.mobileImage} sizes={sizes} priority={priority} className="transition-transform duration-[1200ms] ease-[var(--ease-out-soft)] group-hover:scale-[1.03]" /> : <PhotoFallback nameHe={g.nameHe} />}
          <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(5_15_36/0.82),rgb(5_15_36/0.15)_55%,transparent)]" aria-hidden />
          <div className="absolute inset-x-0 bottom-0 p-5 text-ivory-50 sm:p-6">
            <h3 className="font-display text-[1.6rem] font-medium leading-tight sm:text-[1.8rem]">
              <bdi>{g.name}</bdi>
            </h3>
            <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ivory-100/80">
              <MapPin className="size-3.5 shrink-0 text-gold-300" strokeWidth={1.5} aria-hidden />
              <span className="truncate">{g.place ?? countryName(g.countryCode, locale)}</span>
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              {sendable ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gold-400 px-4 py-2 text-sm font-medium text-midnight-950 transition-colors group-hover:bg-gold-300">
                  {t("send")}
                  <ArrowUpRight className="flip-rtl size-4" strokeWidth={1.6} aria-hidden />
                </span>
              ) : (
                <Badge tone="neutral" className="bg-ivory-50/90">
                  {ta(g.availability.kind === "not_purchasable" ? g.availability.reason : "coming_soon")}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
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

export function GraveCardSkeleton() {
  return (
    <div aria-hidden>
      <div className="skeleton aspect-[4/5] rounded-[1.1rem]" />
    </div>
  );
}
