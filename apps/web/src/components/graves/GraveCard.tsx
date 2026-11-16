import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { InView } from "@/components/motion/InView";
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

/**
 * A tall, narrow arch with a live gold frame: the photograph fills the arch, the name stands beneath it.
 * No price, no statistics. The whole card is the link. The frame's light only travels while the card is on screen.
 */
export function GraveCard({ g, locale, priority, index = 0, tone = "light", sizes = "(min-width:1280px) 20vw, (min-width:1024px) 25vw, (min-width:640px) 33vw, 50vw" }: { g: GraveCardData; locale: string; priority?: boolean; index?: number; tone?: "light" | "dark"; sizes?: string }) {
  const dark = tone === "dark";
  return (
    <InView as="article" className="rv group relative" style={{ ["--i" as string]: index % 6 }}>
      <Link href={`/graves/${g.slug}`} className="block rounded-[1.2rem] focus-visible:outline-offset-8" aria-label={g.name}>
        <div className="gold-ring arch" style={{ aspectRatio: "10 / 19" }}>
          <i className="ring-beam" aria-hidden />
          <i className="ring-beam b2" aria-hidden />
          <div className="ring-inner arch shine once relative h-full w-full overflow-hidden bg-midnight-900">
            {g.cover ? (
              <TziyunPhoto image={g.cover} mobile={g.mobileImage} sizes={sizes} priority={priority} className="depth drift" />
            ) : (
              <PhotoFallback nameHe={g.nameHe} className="[&>span]:hidden" />
            )}
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(5_15_36/0.4),transparent_38%)]" aria-hidden />
          </div>
        </div>
        <div className="mx-auto mt-3.5 max-w-[16rem] text-center sm:mt-4">
          <h3 className={cn("name-plate line-clamp-2 min-h-[2.3em] text-[1.02rem] sm:text-[1.28rem]", dark ? "text-ivory-50" : "text-midnight-900")}>
            <bdi>{g.name}</bdi>
          </h3>
          <p className={cn("mt-1 flex items-center justify-center gap-1 text-[0.74rem] sm:text-[0.82rem]", dark ? "text-ivory-100/70" : "text-charcoal-500")}>
            <MapPin className="size-3 shrink-0 text-gold-500" strokeWidth={1.6} aria-hidden />
            <span className="truncate">{g.place ?? countryName(g.countryCode, locale)}</span>
          </p>
        </div>
      </Link>
    </InView>
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
      <div className="skeleton arch aspect-[10/19]" />
    </div>
  );
}
