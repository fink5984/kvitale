import { cn } from "@/lib/format";

/**
 * KVITALE / קוויטלה brand marks. The symbol is the supplied logo artwork
 * (a note with ruled handwriting lines, a gold frame and ribbon) — never redrawn.
 * It can stand alone (LogoMark) or sit beside a typeset wordmark (Logo).
 * `width`/`height` are the real image ratio (1188×1100) so there is no layout shift.
 */
export function LogoMark({ className, size = "md" }: { className?: string; tone?: "dark" | "light"; size?: "sm" | "md" | "lg" }) {
  const src = size === "lg" ? "/brand/kvitale-logo-600.webp" : "/brand/kvitale-logo-240.webp";
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed brand asset, pre-optimised WebP
    <img src={src} width={1188} height={1100} alt="" aria-hidden decoding="async" className={cn("shrink-0 select-none object-contain", className ?? "h-10 w-auto")} />
  );
}

/** Symbol + typeset wordmark. `name` comes from the message catalog (קוויטלה / KVITALE). */
export function Logo({ name, tone = "dark", className }: { name: string; tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-10 w-auto" />
      <span className={cn("font-display text-[1.55rem] font-medium leading-none tracking-[0.04em]", tone === "light" ? "text-ivory-50" : "text-midnight-900")}>{name}</span>
    </span>
  );
}
