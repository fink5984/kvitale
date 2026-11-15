import { cn } from "@/lib/format";

/** Mark: a pointed limestone arch with a folded note entering the opening. */
export function LogoMark({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  const stroke = tone === "light" ? "#E0C385" : "#B38D48";
  const paper = tone === "light" ? "#FDFBF6" : "#0B1424";
  return (
    <svg viewBox="0 0 36 44" className={cn("shrink-0", className)} aria-hidden>
      <path d="M3 43V20C3 10 9.5 3 18 1.5 26.5 3 33 10 33 20v23" fill="none" stroke={stroke} strokeWidth="1.6" />
      <path d="M8.5 43V21c0-6.6 4-11.6 9.5-13 5.5 1.4 9.5 6.4 9.5 13v22" fill="none" stroke={stroke} strokeWidth="1" opacity=".55" />
      <path d="M13 27.5l5-2.4 5 2.4v9.6l-5 2.4-5-2.4z" fill={paper} stroke={stroke} strokeWidth="1" />
      <path d="M13 27.5l5 2.4 5-2.4M18 29.9v9.6" fill="none" stroke={stroke} strokeWidth=".8" />
      <circle cx="18" cy="18" r="1.4" fill={stroke} />
    </svg>
  );
}

export function Logo({ name, tone = "dark", className }: { name: string; tone?: "dark" | "light"; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="h-8 w-7" tone={tone} />
      <span className={cn("font-display text-[1.6rem] leading-none tracking-wide", tone === "light" ? "text-ivory-50" : "text-midnight-900")}>{name}</span>
    </span>
  );
}
