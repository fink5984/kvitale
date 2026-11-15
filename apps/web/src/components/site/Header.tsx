"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Globe, Menu, ShoppingBag, UserRound, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { CURRENCIES, LOCALE_NATIVE, type AppLocale } from "@/i18n/locales";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/format";
import { useStore } from "@/lib/store";

export function Header({ currency, signedIn, banner }: { currency: string; signedIn: boolean; banner?: ReactNode }) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const variant = pathname === "/" ? "overlay" : "solid";
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const cartCount = useStore((s) => s.cart.reduce((n, e) => n + e.graveSlugs.length, 0));
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const on = () => setScrolled(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  const dark = variant === "overlay" && !scrolled && !open;

  const nav = [
    { href: "/graves", label: t("nav.graves") },
    { href: "/how-it-works", label: t("nav.howItWorks") },
    { href: "/faq", label: t("nav.faq") },
  ];

  return (
    <>
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-500",
        dark ? "bg-transparent" : "bg-ivory-100/85 shadow-[0_1px_0_var(--line)] backdrop-blur-xl",
      )}
    >
      {banner}
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-gold-300 focus:px-4 focus:py-2 focus:text-midnight-950">
        {t("skipToContent")}
      </a>
      <div className="mx-auto flex h-18 max-w-[88rem] items-center gap-6 px-[var(--gutter)]">
        <Link href="/" className="rounded-md" aria-label={t("homeAria")}>
          <Logo name={t("brand")} tone={dark ? "light" : "dark"} />
        </Link>
        <nav aria-label={t("nav.primary")} className="ms-6 hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className={cn("rounded-full px-4 py-2 text-[0.93rem] transition-colors", dark ? "text-ivory-100/80 hover:text-ivory-50" : "text-charcoal-700 hover:text-midnight-900")}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1.5">
          <div className="hidden sm:flex sm:items-center sm:gap-1.5">
            <LanguageMenu dark={dark} />
            <CurrencyMenu dark={dark} currency={currency} />
          </div>
          <Link href={signedIn ? "/account" : "/login"} className={cn("hidden size-10 place-items-center rounded-full transition-colors sm:grid", dark ? "text-ivory-100 hover:bg-ivory-50/10" : "text-midnight-900 hover:bg-stone-100")} aria-label={signedIn ? t("nav.account") : t("nav.signIn")}>
            <UserRound className="size-[1.15rem]" strokeWidth={1.5} />
          </Link>
          <Link href="/cart" className={cn("relative grid size-10 place-items-center rounded-full transition-colors", dark ? "text-ivory-100 hover:bg-ivory-50/10" : "text-midnight-900 hover:bg-stone-100")} aria-label={t("nav.cartAria", { count: mounted ? cartCount : 0 })}>
            <ShoppingBag className="size-[1.15rem]" strokeWidth={1.5} />
            {mounted && cartCount > 0 && <span className="absolute -end-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-gold-400 px-1 text-[0.68rem] font-bold text-midnight-950 tabular">{cartCount}</span>}
          </Link>
          <Link href="/write" className={cn("ms-2 hidden h-10 items-center rounded-full px-5 text-sm font-medium transition-colors md:inline-flex", dark ? "bg-gold-400 text-midnight-950 hover:bg-gold-300" : "bg-midnight-900 text-ivory-50 hover:bg-midnight-800")}>
            {t("cta.write")}
          </Link>
          <button type="button" className={cn("grid size-10 place-items-center rounded-full lg:hidden", dark ? "text-ivory-50" : "text-midnight-900")} aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? t("nav.close") : t("nav.menu")} onClick={() => setOpen((o) => !o)}>
            {open ? <X className="size-5" /> : <Menu className="size-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>
      {open && (
        <div id="mobile-nav" className="border-t border-[var(--line)] bg-ivory-100 px-[var(--gutter)] pb-8 pt-4 lg:hidden">
          <nav aria-label={t("nav.primary")} className="flex flex-col">
            {[...nav, { href: signedIn ? "/account" : "/login", label: signedIn ? t("nav.account") : t("nav.signIn") }].map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="border-b border-[var(--line)] py-4 font-display text-2xl text-midnight-900">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 flex flex-wrap gap-2">
            <LanguageMenu dark={false} />
            <CurrencyMenu dark={false} currency={currency} />
          </div>
          <Link href="/write" onClick={() => setOpen(false)} className="mt-6 flex h-12 items-center justify-center rounded-full bg-midnight-900 text-ivory-50">
            {t("cta.write")}
          </Link>
        </div>
      )}
    </header>
    {variant === "solid" && <div aria-hidden className={banner ? "h-[6.25rem]" : "h-18"} />}
    </>
  );
}

function triggerCls(dark: boolean) {
  return cn("inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm transition-colors", dark ? "text-ivory-100/85 hover:bg-ivory-50/10" : "text-charcoal-700 hover:bg-stone-100");
}
const menuCls = "z-50 min-w-44 rounded-lg border border-[var(--line)] bg-ivory-50 p-1.5 shadow-lift data-[state=open]:animate-[rise_.2s_ease-out]";
const itemCls = "flex cursor-pointer items-center justify-between gap-6 rounded-md px-3 py-2 text-sm text-charcoal-800 outline-none data-[highlighted]:bg-stone-100";

/** Switching language keeps path, query and the in-progress kvittel (session store). */
export function LanguageMenu({ dark }: { dark: boolean }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [pending, start] = useTransition();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={triggerCls(dark)} aria-label={t("language")}>
        <Globe className="size-4" strokeWidth={1.5} />
        <span>{LOCALE_NATIVE[locale as AppLocale]}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={menuCls} sideOffset={6} align="end">
          {routing.locales.map((l) => (
            <DropdownMenu.Item
              key={l}
              className={itemCls}
              disabled={pending}
              onSelect={() => {
                const q = search.toString();
                start(() => router.replace(`${pathname}${q ? `?${q}` : ""}`, { locale: l, scroll: false }));
              }}
            >
              <span lang={l}>{LOCALE_NATIVE[l as AppLocale]}</span>
              {l === locale && <Check className="size-4 text-gold-600" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function CurrencyMenu({ dark, currency }: { dark: boolean; currency: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={triggerCls(dark)} aria-label={t("currency")}>
        <span className="tabular">{currency}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={menuCls} sideOffset={6} align="end">
          {CURRENCIES.map((c) => (
            <DropdownMenu.Item
              key={c}
              className={itemCls}
              onSelect={() => {
                document.cookie = `kv_currency=${c}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
                router.refresh();
              }}
            >
              <span className="tabular">{c}</span>
              {c === currency && <Check className="size-4 text-gold-600" />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
