"use client";

import { useEffect, useState } from "react";
import { TziyunPhoto } from "@/components/graves/Photo";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/format";
import type { GraveImage } from "@/server/graves";

export interface HeroSlide {
  slug: string;
  name: string;
  place: string | null;
  image: GraveImage;
  mobile: GraveImage | null;
}

/**
 * A slow cross-fade between real photographs of tziyunim. Only the first image is
 * loaded eagerly; the rest are lazy and decode off-thread. No motion at all when the
 * visitor prefers reduced motion or the tab is hidden.
 */
export function HeroSlider({ slides, interval = 7000 }: { slides: HeroSlide[]; interval?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      if (!document.hidden) setI((n) => (n + 1) % slides.length);
    }, interval);
    return () => clearInterval(id);
  }, [slides.length, interval]);
  if (!slides.length) return null;
  const cur = slides[i]!;
  return (
    <>
      <div className="absolute inset-0 -z-20 bg-midnight-900" aria-hidden>
        {slides.map((s, idx) => (
          <div key={s.slug} className={cn("absolute inset-0 transition-opacity duration-[1800ms] ease-in-out", idx === i ? "opacity-100" : "opacity-0")}>
            <TziyunPhoto image={s.image} mobile={s.mobile} sizes="100vw" priority={idx === 0} className={cn(idx === i && slides.length > 1 && "scale-[1.04] transition-transform duration-[9000ms] ease-out", idx !== i && "scale-100")} />
          </div>
        ))}
      </div>
      <p className="absolute bottom-5 end-[var(--gutter)] z-10 max-w-[60%] truncate text-xs text-ivory-100/80" aria-live="off">
        <Link href={`/graves/${cur.slug}`} className="underline-offset-4 hover:underline">
          <bdi>{cur.name}</bdi>
          {cur.place ? ` · ${cur.place}` : ""}
        </Link>
      </p>
    </>
  );
}
