import Image, { getImageProps } from "next/image";
import type { GraveImage } from "@/server/graves";
import { cn } from "@/lib/format";

const src = (id: string) => `/api/media/grave/${id}`;
const pos = (i: GraveImage) => `${i.focalX}% ${i.focalY}%`;

/**
 * A real, rights-verified photograph of the tziyun, cropped to its parent (absolute fill).
 * Art direction: a separate mobile crop (portrait) is used below 768px when the admin
 * provided one; otherwise the same image is cropped around its focal point.
 * Next's image optimiser serves responsive AVIF/WebP — originals are never sent to the browser.
 */
export function TziyunPhoto({ image, mobile, sizes = "100vw", priority, className }: { image: GraveImage; mobile?: GraveImage | null; sizes?: string; priority?: boolean; className?: string }) {
  const alt = image.alt ?? "";
  const common = { fill: true as const, sizes, quality: 74, alt };
  if (mobile && mobile.id !== image.id) {
    const d = getImageProps({ ...common, src: src(image.id) });
    const m = getImageProps({ ...common, src: src(mobile.id) });
    return (
      <picture>
        <source media="(min-width: 768px)" srcSet={d.props.srcSet} sizes={sizes} />
        <source media="(max-width: 767px)" srcSet={m.props.srcSet} sizes={sizes} />
        <img {...d.props} alt={alt} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} className={cn("object-cover", className)} style={{ ...d.props.style, objectPosition: pos(image) }} />
      </picture>
    );
  }
  return <Image {...common} alt={alt} src={src(image.id)} priority={priority} className={cn("object-cover", className)} style={{ objectPosition: pos(image) }} />;
}

/**
 * Shown when no verified photo exists. Deliberately a brand surface (deep navy, warm light,
 * the Hebrew name) — never an invented picture of the place.
 */
export function PhotoFallback({ nameHe, className, tone = "night" }: { nameHe: string; className?: string; tone?: "night" | "parchment" }) {
  const night = tone === "night";
  return (
    <div className={cn("absolute inset-0 grid place-items-center overflow-hidden", night ? "bg-midnight-900 text-ivory-50" : "bg-parchment text-midnight-900", className)} aria-hidden>
      <div className={cn("absolute inset-0", night ? "bg-[radial-gradient(80%_70%_at_50%_100%,rgb(194_143_46/0.32),transparent_70%),radial-gradient(60%_50%_at_15%_0%,rgb(46_78_134/0.6),transparent_70%)]" : "bg-[radial-gradient(80%_60%_at_50%_0%,rgb(255_255_255/0.7),transparent_70%)]")} />
      <span lang="he" dir="rtl" className="hebrew-name relative px-[10%] text-center text-[clamp(1.6rem,4.5vw,3rem)] leading-[1.15] opacity-90">
        {nameHe}
      </span>
    </div>
  );
}
