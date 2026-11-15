"use client";

import { createCanvasMeasurer, layoutKvittel, packRgba, PROFILE_58MM_203DPI, renderPage, unpackToRgba, type Ctx2D, type KvittelContent, type KvittelLayout } from "@kvittel/print-layout";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/format";

let fontsPromise: Promise<void> | null = null;
/** Load the exact TTFs used by the server renderer → preview == print. */
export function loadPrintFonts(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  fontsPromise ??= (async () => {
    const faces: Array<[string, string, string, string]> = [
      ["KvittelSerifHebrew", "/print-fonts/NotoSerifHebrew-Regular.ttf", "400", "normal"],
      ["KvittelSerifHebrew", "/print-fonts/NotoSerifHebrew-Bold.ttf", "700", "normal"],
      ["KvittelSerif", "/print-fonts/NotoSerif-Regular.ttf", "400", "normal"],
      ["KvittelSerif", "/print-fonts/NotoSerif-Bold.ttf", "700", "normal"],
      ["KvittelSerif", "/print-fonts/NotoSerif-Italic.ttf", "400", "italic"],
    ];
    await Promise.all(
      faces.map(async ([family, url, weight, style]) => {
        const f = new FontFace(family, `url(${url})`, { weight, style });
        await f.load();
        document.fonts.add(f);
      }),
    );
  })();
  return fontsPromise;
}

export function usePreviewLayout(content: KvittelContent, opts: { dateLine?: string; reference?: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    loadPrintFonts()
      .catch(() => {})
      .finally(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  const measurer = useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    return createCanvasMeasurer(c.getContext("2d") as unknown as Ctx2D);
    // re-create after fonts load so cached widths use the right font
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);
  const layout = useMemo<KvittelLayout | null>(() => (measurer && ready ? layoutKvittel(content, PROFILE_58MM_203DPI, measurer, opts) : null), [content, measurer, ready, opts]);
  return { layout, ready };
}

/**
 * Renders the layout pages exactly as the printer will, at a crisp preview scale.
 * `thermal` shows the true 1-bit dot output.
 */
export function PaperSlips({ layout, images, thermal, className, maxPages }: { layout: KvittelLayout; images?: Record<string, CanvasImageSource>; thermal?: boolean; className?: string; maxPages?: number }) {
  const pages = maxPages ? layout.pages.slice(0, maxPages) : layout.pages;
  return (
    <div className={cn("flex flex-col items-center gap-5", className)}>
      {pages.map((p, i) => (
        <PageCanvas key={i} page={p} widthDots={layout.widthDots} images={images} thermal={thermal} label={layout.pages.length > 1 ? `${i + 1}/${layout.pages.length}` : undefined} />
      ))}
    </div>
  );
}

function PageCanvas({ page, widthDots, images, thermal, label }: { page: KvittelLayout["pages"][number]; widthDots: number; images?: Record<string, CanvasImageSource>; thermal?: boolean; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scale = thermal ? 1 : Math.min(3, (window.devicePixelRatio || 1) * 1.5);
    canvas.width = Math.round(widthDots * scale);
    canvas.height = Math.round(page.heightDots * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (thermal) {
      renderPage(ctx as unknown as Ctx2D, page, widthDots, { images, scale: 1 });
      const img = ctx.getImageData(0, 0, widthDots, page.heightDots);
      const packed = packRgba(img.data, widthDots, page.heightDots, page.ops.some((o) => o.kind === "image") ? "dither" : "threshold");
      const out = ctx.createImageData(widthDots, page.heightDots);
      out.data.set(unpackToRgba(packed, [28, 26, 24], [251, 249, 243]));
      ctx.putImageData(out, 0, 0);
    } else {
      renderPage(ctx as unknown as Ctx2D, page, widthDots, { images, scale, ink: "#1D1B18", paper: "#FBF9F3" });
    }
  }, [page, widthDots, images, thermal]);
  return (
    <figure className="relative mx-auto w-full max-w-[19rem]">
      <canvas ref={ref} className={cn("block h-auto w-full rounded-[2px] bg-[#FBF9F3] shadow-paper", thermal && "[image-rendering:pixelated]")} style={{ aspectRatio: `${widthDots} / ${page.heightDots}` }} aria-hidden />
      {label && <figcaption className="mt-3 text-center text-xs text-charcoal-500 tabular">{label}</figcaption>}
    </figure>
  );
}
