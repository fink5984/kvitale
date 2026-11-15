"use client";

import { ArrowLeft, ArrowRight, Loader2, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { dirOf } from "@/i18n/locales";
import { cn } from "@/lib/format";

interface Result {
  slug: string;
  name: string;
  nameHe: string;
  place: string | null;
  availability: { kind: string; reason?: string };
  isDemo: boolean;
}

/** WAI-ARIA combobox with live, accent- and transliteration-tolerant results. */
export function SearchBox({ currency, tone = "light", autoFocus }: { currency: string; tone?: "light" | "dark"; autoFocus?: boolean }) {
  const t = useTranslations("public.search");
  const ta = useTranslations("status.availability");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const Arrow = dirOf(locale) === "rtl" ? ArrowLeft : ArrowRight;

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}&currency=${currency}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results: Result[] };
        setResults(data.results ?? []);
        setActive(-1);
        setOpen(true);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 140);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, locale, currency]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const submit = () => {
    if (active >= 0 && results[active]) router.push(`/graves/${results[active].slug}`);
    else router.push(`/graves${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
  };

  const dark = tone === "dark";
  return (
    <div ref={boxRef} className="relative w-full">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn(
          "group flex h-16 items-center gap-3 rounded-full ps-6 pe-2 transition-[box-shadow,background-color] duration-300 sm:h-[4.4rem]",
          dark ? "bg-ivory-50/[0.07] ring-1 ring-ivory-50/20 backdrop-blur-md focus-within:bg-ivory-50/[0.12] focus-within:ring-gold-300/70" : "bg-ivory-50 shadow-lift ring-1 ring-stone-300 focus-within:ring-gold-400",
        )}
      >
        <Search className={cn("size-5 shrink-0", dark ? "text-gold-300" : "text-gold-600")} strokeWidth={1.5} aria-hidden />
        <label htmlFor={`${id}-input`} className="sr-only">
          {t("label")}
        </label>
        <input
          id={`${id}-input`}
          role="combobox"
          aria-expanded={open && q.length >= 2}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          autoFocus={autoFocus}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === "Escape") setOpen(false);
          }}
          placeholder={t("placeholder")}
          className={cn("h-full min-w-0 flex-1 bg-transparent text-[1.05rem] outline-none sm:text-lg", dark ? "text-ivory-50 placeholder:text-ivory-100/50" : "text-midnight-900 placeholder:text-charcoal-400")}
        />
        {loading && <Loader2 className={cn("size-4 animate-spin", dark ? "text-ivory-100/60" : "text-charcoal-400")} aria-hidden />}
        <button type="submit" className={cn("inline-flex h-12 shrink-0 items-center gap-2 rounded-full px-5 text-sm font-medium transition-colors sm:h-14 sm:px-7", dark ? "bg-gold-400 text-midnight-950 hover:bg-gold-300" : "bg-midnight-900 text-ivory-50 hover:bg-midnight-800")}>
          <span className="hidden sm:inline">{t("submit")}</span>
          <Arrow className="size-4" aria-hidden />
        </button>
      </form>
      <div aria-live="polite" className="sr-only">
        {open && q.length >= 2 ? t("resultsCount", { count: results.length }) : ""}
      </div>
      {open && q.trim().length >= 2 && (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-[calc(100%+0.6rem)] z-30 max-h-[60vh] overflow-y-auto rounded-2xl border border-[var(--line)] bg-ivory-50 p-2 text-start shadow-lift">
          {results.length === 0 && !loading && (
            <li className="px-4 py-5 text-sm text-charcoal-500">
              {t("noResults")}{" "}
              <Link href={`/request-grave?name=${encodeURIComponent(q)}`} className="font-medium text-midnight-900 underline underline-offset-4">
                {t("requestIt")}
              </Link>
            </li>
          )}
          {results.map((r, i) => (
            <li key={r.slug} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}>
              <Link href={`/graves/${r.slug}`} className={cn("flex items-center gap-4 rounded-xl px-3 py-3 transition-colors", i === active ? "bg-stone-100" : "hover:bg-ivory-200")} onMouseEnter={() => setActive(i)}>
                <span className="tex-stone grid size-12 shrink-0 place-items-center rounded-t-full rounded-b-sm ring-1 ring-stone-300">
                  <span className="hebrew-name text-[0.8rem] leading-none text-midnight-900" lang="he" dir="rtl">
                    {r.nameHe.split(" ").slice(-1)[0]}
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg leading-tight text-midnight-900">
                    <bdi>{r.name}</bdi>
                  </span>
                  <span className="block truncate text-[0.82rem] text-charcoal-500">{r.place}</span>
                </span>
                <span className={cn("hidden shrink-0 text-xs sm:block", r.availability.kind === "available_now" ? "text-sage-600" : "text-charcoal-500")}>{ta(r.availability.kind === "available_now" ? "available_now" : r.availability.reason!)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
