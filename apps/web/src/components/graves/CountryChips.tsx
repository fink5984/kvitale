import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/format";

/** Country filter as plain links: works without JavaScript, shareable, and horizontally scrollable on phones. */
export function CountryChips({ countries, current, q, allLabel }: { countries: Array<{ value: string; label: string }>; current?: string; q?: string; allLabel: string }) {
  const href = (country?: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (country) p.set("country", country);
    const s = p.toString();
    return `/graves${s ? `?${s}` : ""}`;
  };
  const chip = (active: boolean) => cn("inline-flex h-10 shrink-0 items-center rounded-full border px-4 text-sm transition-colors", active ? "border-midnight-900 bg-midnight-900 text-ivory-50" : "border-[var(--line-strong)] bg-ivory-50 text-charcoal-700 hover:border-midnight-900");
  return (
    <nav aria-label={allLabel} className="-mx-[var(--gutter)] flex gap-2 overflow-x-auto px-[var(--gutter)] pb-1 [scrollbar-width:none]">
      <Link href={href()} className={chip(!current)} aria-current={!current ? "true" : undefined}>
        {allLabel}
      </Link>
      {countries.map((c) => (
        <Link key={c.value} href={href(c.value)} className={chip(current === c.value)} aria-current={current === c.value ? "true" : undefined}>
          {c.label}
        </Link>
      ))}
    </nav>
  );
}
