"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/format";

/**
 * Plain GET form → works without JavaScript; with JS, changes apply instantly.
 */
export function FilterBar({ countries, dynasties, current, total }: { countries: Array<{ value: string; label: string }>; dynasties: string[]; current: Record<string, string | undefined>; total: number }) {
  const t = useTranslations("public.directory.filters");
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(sp.toString());
    if (v) next.set(k, v);
    else next.delete(k);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };
  const active = ["country", "status", "dynasty"].filter((k) => current[k]);
  const sel = "h-10 rounded-full border border-[var(--line-strong)] bg-ivory-50 ps-4 pe-9 text-sm text-midnight-900 hover:border-stone-400 focus:border-gold-500 focus:outline-none appearance-none bg-no-repeat bg-[length:10px] bg-[position:right_14px_center] rtl:bg-[position:left_14px_center]";
  const arrow = { backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%233b3731' stroke-width='1.5'/%3E%3C/svg%3E\")" };

  return (
    <form method="get" className="sticky top-[6.25rem] z-20 -mx-[var(--gutter)] flex flex-wrap items-center gap-2.5 border-b border-[var(--line)] bg-ivory-100/90 px-[var(--gutter)] py-4 backdrop-blur-lg" onSubmit={(e) => e.preventDefault()}>
      <span className="me-1 hidden items-center gap-2 text-sm font-medium text-charcoal-700 sm:inline-flex">
        <SlidersHorizontal className="size-4" strokeWidth={1.5} aria-hidden /> {t("label")}
      </span>
      {current.q && <input type="hidden" name="q" value={current.q} />}
      <label className="sr-only" htmlFor="f-status">
        {t("availability")}
      </label>
      <select id="f-status" name="status" defaultValue={current.status ?? ""} onChange={(e) => set("status", e.target.value)} className={sel} style={arrow}>
        <option value="">{t("anyAvailability")}</option>
        <option value="available">{t("availableNow")}</option>
        <option value="purchasable">{t("purchasable")}</option>
        <option value="soon">{t("comingSoon")}</option>
      </select>
      <label className="sr-only" htmlFor="f-country">
        {t("country")}
      </label>
      <select id="f-country" name="country" defaultValue={current.country ?? ""} onChange={(e) => set("country", e.target.value)} className={sel} style={arrow}>
        <option value="">{t("anyCountry")}</option>
        {countries.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="f-dynasty">
        {t("tradition")}
      </label>
      <select id="f-dynasty" name="dynasty" defaultValue={current.dynasty ?? ""} onChange={(e) => set("dynasty", e.target.value)} className={sel} style={arrow}>
        <option value="">{t("anyTradition")}</option>
        {dynasties.map((d) => (
          <option key={d} value={d}>
            {t(`dynasty.${d}`)}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="f-sort">
        {t("sort")}
      </label>
      <select id="f-sort" name="sort" defaultValue={current.sort ?? ""} onChange={(e) => set("sort", e.target.value)} className={sel} style={arrow}>
        <option value="">{t("sortFeatured")}</option>
        <option value="hilula">{t("sortHilula")}</option>
        <option value="name">{t("sortName")}</option>
      </select>
      <noscript>
        <button type="submit" className="h-10 rounded-full bg-midnight-900 px-4 text-sm text-ivory-50">
          {t("apply")}
        </button>
      </noscript>
      {active.length > 0 && (
        <button type="button" onClick={() => router.replace(current.q ? `${pathname}?q=${encodeURIComponent(current.q)}` : pathname, { scroll: false })} className={cn("inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-charcoal-600 hover:bg-stone-100")}>
          <X className="size-3.5" /> {t("clear")}
        </button>
      )}
      <span className="ms-auto text-sm text-charcoal-500 tabular" aria-live="polite">
        {t("count", { count: total })}
      </span>
    </form>
  );
}
