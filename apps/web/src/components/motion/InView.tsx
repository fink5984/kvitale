"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * Marks its box with data-inview (live: true only while on screen, so loops can pause otherwise) and
 * data-seen (latched: set the first time it is visible, drives entrance animations).
 * It sets plain DOM attributes, so scrolling never re-renders React.
 */
export function InView({ children, className, style, as: Tag = "div", margin = "0px 0px -8% 0px" }: { children: ReactNode; className?: string; style?: CSSProperties; as?: "div" | "span" | "li" | "article" | "section"; margin?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      el.dataset.seen = "true";
      el.dataset.inview = "true";
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          el.dataset.inview = e.isIntersecting ? "true" : "false";
          if (e.isIntersecting) el.dataset.seen = "true";
        }
      },
      { rootMargin: margin, threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [margin]);
  const T = Tag as "div";
  return (
    <T ref={ref as React.RefObject<HTMLDivElement>} data-seen="false" data-inview="false" className={className} style={style}>
      {children}
    </T>
  );
}
