/**
 * Kvittel Design System — core primitives.
 * Consistent radii (2/4/8/14), warm shadows, gold used only as light & focus.
 */
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/format";

export { Checkbox, Modal, Drawer } from "./client";

/* ───────────── Button ───────────── */

type Variant = "primary" | "gold" | "outline" | "ghost" | "quiet" | "danger" | "onDark";
type Size = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-midnight-900 text-ivory-50 hover:bg-midnight-800 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)] active:translate-y-px",
  gold: "bg-gold-400 text-midnight-950 hover:bg-gold-300 shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_8px_24px_-12px_rgb(179_141_72/0.8)] active:translate-y-px",
  outline: "border border-[var(--line-strong)] bg-transparent text-midnight-900 hover:border-midnight-900 hover:bg-ivory-50",
  ghost: "bg-transparent text-midnight-900 hover:bg-stone-100",
  quiet: "bg-stone-100 text-midnight-900 hover:bg-stone-200",
  danger: "bg-oxblood-600 text-ivory-50 hover:bg-oxblood-600/90",
  onDark: "border border-ivory-50/25 text-ivory-50 hover:bg-ivory-50/10 hover:border-ivory-50/50",
};
const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm gap-1.5",
  md: "h-11 px-5 text-[0.95rem] gap-2",
  lg: "h-13 px-7 text-base gap-2.5",
  xl: "h-15 px-9 text-[1.05rem] gap-3",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export const buttonClass = (variant: Variant = "primary", size: Size = "md", extra?: string) =>
  cn(
    "inline-flex items-center justify-center rounded-full font-medium tracking-[0.01em] whitespace-nowrap select-none",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-200 ease-[var(--ease-out-soft)]",
    "disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = "primary", size = "md", loading, icon, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

/* ───────────── Form fields ───────────── */

export function Field({ label, hint, error, children, htmlFor, optional, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; htmlFor?: string; optional?: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-baseline justify-between gap-3 text-sm font-medium text-charcoal-800">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-charcoal-500">{optional}</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-oxblood-600">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[0.8rem] leading-relaxed text-charcoal-500">{hint}</p>
      ) : null}
    </div>
  );
}

const fieldBase =
  "w-full rounded-md border border-[var(--line-strong)] bg-ivory-50 px-3.5 text-[0.98rem] text-midnight-900 placeholder:text-charcoal-400 shadow-[inset_0_1px_2px_rgb(41_31_15/0.05)] transition-colors duration-150 hover:border-stone-400 focus:border-gold-500 focus:outline-none focus:ring-3 focus:ring-gold-300/40 disabled:opacity-60 aria-[invalid=true]:border-oxblood-600";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cn(fieldBase, "h-11", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn(fieldBase, "min-h-32 py-3 leading-relaxed", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...rest }, ref) {
  return (
    <select ref={ref} className={cn(fieldBase, "h-11 appearance-none bg-[length:12px] bg-[position:right_14px_center] bg-no-repeat pe-9 rtl:bg-[position:left_14px_center]", className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%233b3731' stroke-width='1.5'/%3E%3C/svg%3E\")" }} {...rest}>
      {children}
    </select>
  );
});

export function Segmented<T extends string>({ value, onChange, options, label, size = "md" }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: ReactNode }>; label: string; size?: "sm" | "md" }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full border border-[var(--line-strong)] bg-ivory-50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-full font-medium transition-all duration-200",
            size === "sm" ? "h-7 px-3 text-xs" : "h-9 px-4 text-sm",
            value === o.value ? "bg-midnight-900 text-ivory-50 shadow-soft" : "text-charcoal-600 hover:text-midnight-900",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ───────────── Surfaces ───────────── */

export function Card({ className, children, as: As = "div", ...rest }: { className?: string; children: ReactNode; as?: "div" | "section" | "article" | "li" } & Record<string, unknown>) {
  return (
    <As className={cn("rounded-lg border border-[var(--line)] bg-[var(--surface)] shadow-soft", className)} {...rest}>
      {children}
    </As>
  );
}

type Tone = "neutral" | "gold" | "success" | "warning" | "danger" | "info" | "night";
const TONES: Record<Tone, string> = {
  neutral: "bg-stone-100 text-charcoal-700 ring-stone-300/70",
  gold: "bg-gold-100 text-gold-700 ring-gold-300/70",
  success: "bg-sage-100 text-sage-600 ring-sage-600/20",
  warning: "bg-ochre-100 text-ochre-600 ring-ochre-600/20",
  danger: "bg-oxblood-100 text-oxblood-600 ring-oxblood-600/20",
  info: "bg-ink-100 text-ink-600 ring-ink-600/20",
  night: "bg-midnight-800 text-gold-200 ring-gold-400/30",
};

export function Badge({ tone = "neutral", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[0.75rem] font-medium ring-1 ring-inset whitespace-nowrap", TONES[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full bg-current", tone === "success" && "animate-pulse")} aria-hidden />}
      {children}
    </span>
  );
}

export function DemoBadge({ label = "DEMO", className }: { label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-[3px] border border-dashed border-ochre-600/60 bg-ochre-100/70 px-1.5 py-px font-mono text-[0.65rem] font-semibold tracking-[0.12em] text-ochre-600", className)} title="Demonstration data — not live fact">
      {label}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} aria-hidden />;
}

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-charcoal-500", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export function EmptyState({ title, body, action, icon }: { title: ReactNode; body?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-stone-300 bg-ivory-50/60 px-6 py-14 text-center">
      <div className="text-gold-500">{icon ?? <ArchGlyph className="h-12 w-10" />}</div>
      <div className="max-w-sm">
        <h3 className="font-display text-2xl text-midnight-900">{title}</h3>
        {body && <p className="mt-2 text-sm leading-relaxed text-charcoal-500">{body}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title, body, action }: { title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-oxblood-600/25 bg-oxblood-100/50 p-5">
      <h3 className="font-medium text-oxblood-600">{title}</h3>
      {body && <p className="text-sm text-charcoal-700">{body}</p>}
      {action}
    </div>
  );
}

export function Notice({ tone = "info", title, children, className }: { tone?: "info" | "warning" | "success" | "gold"; title?: ReactNode; children: ReactNode; className?: string }) {
  const t = { info: "border-ink-600/20 bg-ink-100/60", warning: "border-ochre-600/25 bg-ochre-100/70", success: "border-sage-600/25 bg-sage-100/70", gold: "border-gold-400/40 bg-gold-100/60" }[tone];
  return (
    <div className={cn("rounded-md border px-4 py-3 text-sm leading-relaxed text-charcoal-800", t, className)}>
      {title && <p className="mb-0.5 font-semibold text-midnight-900">{title}</p>}
      {children}
    </div>
  );
}

/* ───────────── Stepper ───────────── */

export function Stepper({ steps, current, label }: { steps: string[]; current: number; label: string }) {
  return (
    <nav aria-label={label}>
      <ol className="flex items-center gap-2 sm:gap-3">
        {steps.map((s, i) => {
          const state = i < current ? "done" : i === current ? "current" : "upcoming";
          return (
            <li key={s} className="flex min-w-0 items-center gap-2 sm:gap-3" aria-current={state === "current" ? "step" : undefined}>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold tabular transition-all duration-300",
                  state === "done" && "bg-midnight-900 text-gold-300",
                  state === "current" && "bg-gold-400 text-midnight-950 shadow-glow",
                  state === "upcoming" && "border border-stone-300 text-charcoal-500",
                )}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={cn("hidden truncate text-sm md:inline", state === "current" ? "font-semibold text-midnight-900" : "text-charcoal-500")}>{s}</span>
              {i < steps.length - 1 && <span className="h-px w-4 bg-stone-300 sm:w-8" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ───────────── Modal & Drawer (Radix: focus trap, Esc, aria) ───────────── */

/* ───────────── Ornaments ───────────── */

export function ArchGlyph({ className, strokeWidth = 1.2 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 40 52" className={className} fill="none" stroke="currentColor" strokeWidth={strokeWidth} aria-hidden>
      <path d="M4 51V22C4 11 11 3 20 1.5 29 3 36 11 36 22v29" />
      <path d="M9 51V23c0-8 5-14 11-15.5C26 9 31 15 31 23v28" opacity=".55" />
      <circle cx="20" cy="22" r="1.6" fill="currentColor" stroke="none" />
      <path d="M0 51h40" />
    </svg>
  );
}

export function Ornament({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-3 text-gold-500", className)} aria-hidden>
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-current sm:w-20" />
      <svg viewBox="0 0 24 12" className="h-3 w-6" fill="currentColor">
        <path d="M12 0l3 6-3 6-3-6z" />
        <circle cx="3" cy="6" r="1.2" />
        <circle cx="21" cy="6" r="1.2" />
      </svg>
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-current sm:w-20" />
    </div>
  );
}
