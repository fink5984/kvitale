"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TziyunPhoto } from "@/components/graves/Photo";
import { cn } from "@/lib/format";
import type { GraveImage } from "@/server/graves";

export interface HeroSlide {
  slug: string;
  image: GraveImage;
  mobile: GraveImage | null;
}

/** Tuning knobs, in one place. */
export const HERO_SLIDER = {
  /** How long one photograph stays before the next begins to appear. */
  intervalMs: 9000,
  /** Length of the cross-fade. Long on purpose: the change should be barely noticed. */
  crossfadeMs: 3600,
  /** Very slow push-in on the visible photograph (scale 1 -> this). */
  zoomTo: 1.07,
} as const;

/**
 * An almost-invisible cross-fade between real photographs of tziyunim.
 *  - Layers overlap and only opacity changes: there is never a frame without a background, no fade to black.
 *  - Photographs are mounted one at a time; a transition only starts once the NEXT photograph has fully loaded.
 *  - No captions: the photograph alone makes the atmosphere.
 *  - Reduced motion, a hidden tab or a single photograph: it simply stays still.
 */
export function HeroSlider({ slides }: { slides: HeroSlide[] }) {
  const n = slides.length;
  const [cur, setCur] = useState(0);
  const [mounted, setMounted] = useState(1); // how many slides are in the DOM
  const loaded = useRef<Set<number>>(new Set());
  const [, bump] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  const onLoaded = useCallback((idx: number) => {
    if (loaded.current.has(idx)) return;
    loaded.current.add(idx);
    bump((x) => x + 1);
  }, []);

  // photographs that finished loading before hydration never fire a load event: pick them up here
  useEffect(() => {
    Array.from(root.current?.children ?? []).forEach((el, idx) => {
      const img = el.querySelector("img");
      if (img?.complete && img.naturalWidth > 0) onLoaded(idx);
    });
  }, [mounted, onLoaded]);

  // after the first photograph is on screen, mount the next one (each only after the previous has loaded)
  useEffect(() => {
    if (n < 2 || mounted >= n || !loaded.current.has(mounted - 1)) return;
    const id = window.setTimeout(() => setMounted((m) => Math.min(n, m + 1)), 600);
    return () => window.clearTimeout(id);
  });

  useEffect(() => {
    if (n < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setCur((c) => {
        const next = (c + 1) % n;
        return next < mounted && loaded.current.has(next) ? next : c; // next photograph not ready yet: stay
      });
    }, HERO_SLIDER.intervalMs);
    return () => window.clearInterval(id);
  }, [n, mounted]);

  if (!n) return null;
  return (
    <div ref={root} className="absolute inset-0" aria-hidden>
      {slides.slice(0, mounted).map((s, idx) => {
        const active = idx === cur;
        return (
          <div
            key={s.slug}
            onLoadCapture={() => onLoaded(idx)}
            className={cn("absolute inset-0 will-change-[opacity]", active ? "z-[1] opacity-100" : "z-0 opacity-0")}
            style={{ transition: `opacity ${HERO_SLIDER.crossfadeMs}ms ease-in-out` }}
          >
            <div
              className="absolute inset-0"
              style={{
                scale: active && n > 1 ? HERO_SLIDER.zoomTo : 1,
                // zoom slowly while visible; snap back only once the layer is fully faded out
                transition: active ? `scale ${HERO_SLIDER.intervalMs + HERO_SLIDER.crossfadeMs}ms linear` : `scale 0s linear ${HERO_SLIDER.crossfadeMs}ms`,
              }}
            >
              <TziyunPhoto image={s.image} mobile={s.mobile} sizes="100vw" priority={idx === 0} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
