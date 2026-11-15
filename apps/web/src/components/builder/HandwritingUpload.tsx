"use client";

import { RotateCw, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Button, Notice } from "@/components/ui";

/**
 * The customer's handwriting is kept as an image — never OCR'd or "corrected".
 * Only user-controlled rotate / contrast / brightness / crop-margin adjustments.
 * The server re-encodes the result (strips metadata) and stores it encrypted.
 */
export function HandwritingUpload({ value, onChange }: { value: { ref: string; size: { width: number; height: number } } | null; onChange: (v: { ref: string; size: { width: number; height: number } } | null, img?: HTMLImageElement) => void }) {
  const t = useTranslations("builder.hand");
  const [src, setSrc] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState(0);
  const [contrast, setContrast] = useState(130);
  const [brightness, setBrightness] = useState(105);
  const [trim, setTrim] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onFile = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    if (!["image/jpeg", "image/png"].includes(f.type)) return setError(t("errors.type"));
    if (f.size > 8 * 1024 * 1024) return setError(t("errors.size"));
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => setSrc(img);
    img.onerror = () => setError(t("errors.decode"));
    img.src = url;
  };

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !src) return;
    const maxSide = 1600;
    const rot = rotation % 180 !== 0;
    const w0 = rot ? src.height : src.width;
    const h0 = rot ? src.width : src.height;
    const s = Math.min(1, maxSide / Math.max(w0, h0));
    const tw = Math.round(w0 * s);
    const th = Math.round(h0 * s);
    const cx = Math.round((tw * trim) / 100);
    const cy = Math.round((th * trim) / 100);
    c.width = tw - 2 * cx;
    c.height = th - 2 * cy;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.save();
    ctx.filter = `grayscale(1) contrast(${contrast}%) brightness(${brightness}%)`;
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(src, (-src.width * s) / 2, (-src.height * s) / 2, src.width * s, src.height * s);
    ctx.restore();
  }, [src, rotation, contrast, brightness, trim]);

  const upload = async () => {
    const c = canvasRef.current;
    if (!c) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
      if (!blob) throw new Error("encode");
      const fd = new FormData();
      fd.append("file", blob, "handwriting.png");
      const res = await fetch("/api/uploads/handwriting", { method: "POST", body: fd });
      const data = (await res.json()) as { ref?: string; width?: number; height?: number; error?: string };
      if (!res.ok || !data.ref) throw new Error(data.error ?? "upload");
      const img = new Image();
      img.src = c.toDataURL("image/png");
      await img.decode();
      onChange({ ref: data.ref, size: { width: data.width!, height: data.height! } }, img);
      setSrc(null);
    } catch {
      setError(t("errors.upload"));
    } finally {
      setBusy(false);
    }
  };

  if (value)
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-sage-600/30 bg-sage-100/50 px-4 py-3 text-sm">
        <span>{t("attached", { w: value.size.width, h: value.size.height })}</span>
        <Button type="button" variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => onChange(null)}>
          {t("remove")}
        </Button>
      </div>
    );

  return (
    <div className="space-y-4">
      {!src ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-stone-400 bg-ivory-50 px-6 py-8 text-center transition-colors hover:border-gold-500">
          <Upload className="size-5 text-gold-600" aria-hidden />
          <span className="font-medium text-midnight-900">{t("choose")}</span>
          <span className="text-xs text-charcoal-500">{t("formats")}</span>
          <input type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          <div className="grid place-items-center rounded-lg bg-stone-100 p-3">
            <canvas ref={canvasRef} className="max-h-80 w-auto max-w-full shadow-soft" aria-label={t("previewAria")} />
          </div>
          <div className="space-y-4 text-sm">
            <Button type="button" variant="outline" size="sm" icon={<RotateCw className="size-4" />} onClick={() => setRotation((r) => (r + 90) % 360)}>
              {t("rotate")}
            </Button>
            {(
              [
                ["contrast", contrast, setContrast, 80, 220],
                ["brightness", brightness, setBrightness, 70, 160],
                ["trim", trim, setTrim, 0, 20],
              ] as const
            ).map(([k, v, set, min, max]) => (
              <label key={k} className="block">
                <span className="text-charcoal-600">{t(k)}</span>
                <input type="range" min={min} max={max} value={v} onChange={(e) => set(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-gold-500)]" />
              </label>
            ))}
            <div className="flex gap-2">
              <Button type="button" size="sm" loading={busy} onClick={upload}>
                {t("attach")}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setSrc(null)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        </div>
      )}
      <p className="text-xs text-charcoal-500">{t("noAi")}</p>
      {error && <Notice tone="warning">{error}</Notice>}
    </div>
  );
}
