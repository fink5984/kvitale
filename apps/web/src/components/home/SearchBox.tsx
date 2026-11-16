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
}

/** WAI-ARIA combobox with live, accent- and transliteration-tolerant results. */
export function SearchBox({ tone = "light", autoFocus, initialQuery = "" }: { tone?: "light" | "dark"; autoFocus?: boolean; initialQuery?: string }) {
  const t = useTranslations("site.search");
  const ta = useTranslations("status.availability");
  const locale = useLocale();
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState(initialQuery);
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
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&locale=${locale}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results: Result[] };
        setResults(data.results ?? []);
        setActive(data.results?.length ? 0 : -1);
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
  }, [q, locale]);

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
    <div ref={boxRef} className="relative w-full scroll-mt-28">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={cn("gold-ring pill-ring ring-live group h-14 sm:h-[3.6rem]", dark ? "shadow-[0_20px_50px_-20px_rgb(0_0_0/0.75),0_0_30px_-8px_rgb(224_178_79/0.5)]" : "")}
      >
        <i className="ring-beam" aria-hidden />
        <i className="ring-beam b2" aria-hidden />
        <div className="ring-inner flex h-full w-full items-center gap-2.5 rounded-full bg-ivory-50 ps-5 pe-1.5">
          <Search className="size-[1.15rem] shrink-0 text-gold-600" strokeWidth={1.6} aria-hidden />
          <label htmlFor={`${id}-input`} className="sr-only">
            {t("label")}
          </label>
          <input
            id={`${id}-input`}
            role="combobox"
            aria-expanded={open && q.trim().length >= 2}
            aria-controls={`${id}-list`}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => {
              if (results.length) setOpen(true);
              // on phones, lift the field to the top so the keyboard never hides the results
              if (window.matchMedia("(max-width: 639px)").matches) boxRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === "Escape") setOpen(false);
            }}
            placeholder={t("placeholder")}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-midnight-900 placeholder:text-charcoal-400 sm:text-[1.05rem]"
          />
          <span className="grid size-5 shrink-0 place-items-center" aria-hidden>
            <Loader2 className={cn("size-4 animate-spin text-charcoal-400 transition-opacity duration-200", loading ? "opacity-100" : "opacity-0")} />
          </span>
          <button type="submit" className="btn-shine inline-flex h-[2.6rem] shrink-0 items-center gap-2 rounded-full bg-midnight-900 px-4 text-sm font-medium text-ivory-50 transition-colors hover:bg-midnight-800 sm:h-11 sm:px-6">
            <span className="hidden sm:inline">{t("submit")}</span>
            <Arrow className="size-4" aria-hidden />
          </button>
        </div>
      </form>
      <div aria-live="polite" className="sr-only">
        {open && q.length >= 2 ? t("resultsCount", { count: results.length }) : ""}
      </div>
      {open && q.trim().length >= 2 && (
        <ul id={`${id}-list`} role="listbox" className="rise-in absolute inset-x-0 top-[calc(100%+0.6rem)] z-30 max-h-[min(60vh,26rem)] overflow-y-auto overscroll-contain rounded-2xl border border-gold-300/60 bg-ivory-50 p-2 text-start shadow-lift [--d:0]">
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
              <Link href={`/graves/${r.slug}`} className={cn("flex items-center gap-4 rounded-xl px-3 py-3 transition-colors", i === active ? "bg-gold-100 ring-1 ring-gold-300/70" : "hover:bg-ivory-200")} onMouseEnter={() => setActive(i)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-lg leading-tight text-midnight-900">
                    <bdi>{r.name}</bdi>
                  </span>
                  <span className="block truncate text-[0.82rem] text-charcoal-500">{r.place}</span>
                </span>
                {r.availability.kind === "not_purchasable" && <span className="hidden shrink-0 text-xs text-charcoal-500 sm:block">{ta(r.availability.reason!)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
