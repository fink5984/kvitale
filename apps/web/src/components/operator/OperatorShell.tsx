"use client";

import { ClipboardList, Gauge, LayoutDashboard, LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { signOut } from "@/app/actions/public";
import { LogoMark } from "@/components/brand/Logo";
import { LanguageMenu } from "@/components/site/Header";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/format";

/** Mobile-first field shell: compact top bar + thumb-reachable bottom tabs on phones. */
export function OperatorShell({ children, who, scopeLabel, canAdmin, demo }: { children: ReactNode; who: string; scopeLabel: string; canAdmin: boolean; demo: boolean }) {
  const t = useTranslations("operator.shell");
  const pathname = usePathname();
  const locale = useLocale();
  const tabs = [
    { href: "/operator", label: t("units"), icon: Gauge, active: pathname === "/operator" || pathname.startsWith("/operator/roll") },
    { href: "/operator/tickets", label: t("tickets"), icon: ClipboardList, active: pathname.startsWith("/operator/tickets") },
  ];
  return (
    <div className="min-h-dvh bg-ivory-100 pb-24 sm:pb-0">
      <header className="tex-night sticky top-0 z-30 text-ivory-50">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/operator" className="flex items-center gap-2.5">
            <LogoMark className="h-7 w-6" tone="light" />
            <span className="leading-tight">
              <span className="font-display block text-lg">{t("title")}</span>
              <span className="block text-[0.62rem] uppercase tracking-[0.18em] text-gold-300/70">{scopeLabel}</span>
            </span>
          </Link>
          <nav aria-label={t("nav")} className="ms-6 hidden items-center gap-1 sm:flex">
            {tabs.map((tb) => (
              <Link key={tb.href} href={tb.href} aria-current={tb.active ? "page" : undefined} className={cn("inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm transition-colors", tb.active ? "bg-gold-400/15 text-gold-200 ring-1 ring-gold-400/30" : "text-ivory-100/70 hover:text-ivory-50")}>
                <tb.icon className="size-4" strokeWidth={1.5} aria-hidden />
                {tb.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-1">
            {demo && <span className="hidden rounded-[3px] border border-dashed border-ochre-100/50 px-1.5 py-0.5 font-mono text-[0.6rem] tracking-[0.14em] text-ochre-100 sm:inline">DEMO</span>}
            <LanguageMenu dark />
            {canAdmin && (
              <Link href="/admin" className="hidden h-9 items-center gap-1.5 rounded-full px-3 text-sm text-ivory-100/75 hover:text-ivory-50 sm:inline-flex">
                <LayoutDashboard className="size-4" strokeWidth={1.5} /> {t("admin")}
              </Link>
            )}
            <button
              type="button"
              onClick={async () => {
                await signOut();
                window.location.href = `/${locale}`;
              }}
              className="grid size-9 place-items-center rounded-full text-ivory-100/70 hover:bg-ivory-50/10 hover:text-ivory-50"
              aria-label={t("signOut", { who })}
              title={who}
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
        {children}
      </main>
      <nav aria-label={t("nav")} className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 border-t border-[var(--line)] bg-ivory-50/95 pb-[max(env(safe-area-inset-bottom),0.25rem)] backdrop-blur-lg sm:hidden">
        {tabs.map((tb) => (
          <Link key={tb.href} href={tb.href} aria-current={tb.active ? "page" : undefined} className={cn("flex flex-col items-center gap-0.5 py-2.5 text-[0.72rem]", tb.active ? "text-midnight-900" : "text-charcoal-500")}>
            <tb.icon className={cn("size-5", tb.active && "text-gold-600")} strokeWidth={1.5} aria-hidden />
            {tb.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
