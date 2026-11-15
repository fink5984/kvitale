"use client";

import { Activity, BarChart3, Bell, BookOpen, ChevronDown, Coins, Cpu, FlaskConical, Handshake, Landmark, LogOut, Menu, QrCode, ReceiptText, Search, Settings, ShieldCheck, Tags, Users, X, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "@/app/actions/public";
import { LogoMark } from "@/components/brand/Logo";
import { LanguageMenu } from "@/components/site/Header";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/format";
import type { ClientSession } from "@/server/admin-guard";

interface NavItem {
  href: string;
  key: string;
  icon: LucideIcon;
  perm: string;
  badge?: number;
}

export function AdminShell({ session, children, openAlerts, demo }: { session: ClientSession; children: ReactNode; openAlerts: number; demo: boolean }) {
  const t = useTranslations("admin.nav");
  const pathname = usePathname();
  const router = useRouter();
  const locale = useLocale();
  const [mobile, setMobile] = useState(false);
  const [q, setQ] = useState("");
  const can = (p: string) => (session.permissions as string[]).includes(p);

  const groups: Array<{ key: string; items: NavItem[] }> = [
    { key: "overview", items: [{ href: "/admin", key: "overview", icon: BarChart3, perm: "overview.read" }] },
    {
      key: "operations",
      items: [
        { href: "/admin/orders", key: "orders", icon: ReceiptText, perm: "orders.read" },
        { href: "/admin/customers", key: "customers", icon: Users, perm: "customers.read" },
      ],
    },
    {
      key: "catalogue",
      items: [
        { href: "/admin/graves", key: "graves", icon: Landmark, perm: "graves.read" },
        { href: "/admin/pricing", key: "pricing", icon: Tags, perm: "pricing.read" },
        { href: "/admin/content", key: "content", icon: BookOpen, perm: "content.write" },
      ],
    },
    {
      key: "fleet",
      items: [
        { href: "/admin/devices", key: "devices", icon: Cpu, perm: "devices.read" },
        { href: "/admin/devices/pair", key: "pairing", icon: QrCode, perm: "devices.provision" },
        { href: "/admin/alerts", key: "alerts", icon: Bell, perm: "maintenance.manage", badge: openAlerts },
        ...(demo ? [{ href: "/admin/lab", key: "lab", icon: FlaskConical, perm: "lab.use" }] : []),
      ],
    },
    {
      key: "business",
      items: [
        { href: "/admin/finance", key: "finance", icon: Coins, perm: "finance.read" },
        { href: "/admin/partners", key: "partners", icon: Handshake, perm: "partners.manage" },
      ],
    },
    {
      key: "system",
      items: [
        { href: "/admin/settings", key: "settings", icon: Settings, perm: "settings.write" },
        { href: "/admin/audit", key: "audit", icon: ShieldCheck, perm: "audit.read" },
        { href: "/admin/activity", key: "activity", icon: Activity, perm: "devices.read" },
      ],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) }))
    .filter((g) => g.items.length);

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setCollapsed(JSON.parse(localStorage.getItem("kv_admin_nav") ?? "{}"));
    } catch {}
  }, []);
  const toggle = (k: string) =>
    setCollapsed((c) => {
      const n = { ...c, [k]: !c[k] };
      try {
        localStorage.setItem("kv_admin_nav", JSON.stringify(n));
      } catch {}
      return n;
    });
  useEffect(() => setMobile(false), [pathname]);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`)) && !(href === "/admin/devices" && pathname.startsWith("/admin/devices/pair"));

  const nav = (
    <nav aria-label={t("label")} className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <LogoMark className="h-8 w-7" tone="light" />
        <div className="leading-tight">
          <p className="font-display text-xl text-ivory-50">{t("brand")}</p>
          <p className="text-[0.65rem] uppercase tracking-[0.2em] text-gold-300/70">{t("console")}</p>
        </div>
      </div>
      <form
        role="search"
        className="mx-3 mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <label className="flex h-9 items-center gap-2 rounded-md bg-ivory-50/[0.06] px-3 text-sm text-ivory-100/80 ring-1 ring-ivory-50/10 focus-within:ring-gold-400/60">
          <Search className="size-3.5 opacity-70" aria-hidden />
          <span className="sr-only">{t("search")}</span>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPh")} className="min-w-0 flex-1 bg-transparent placeholder:text-ivory-100/40 focus:outline-none" />
          <kbd className="hidden rounded bg-ivory-50/10 px-1.5 text-[0.65rem] text-ivory-100/50 lg:inline">/</kbd>
        </label>
      </form>
      <div className="scroll-thin flex-1 space-y-1 overflow-y-auto px-3 pb-6">
        {groups.map((g) => (
          <div key={g.key}>
            {g.key !== "overview" && (
              <button type="button" onClick={() => toggle(g.key)} aria-expanded={!collapsed[g.key]} className="flex w-full items-center justify-between px-2 pb-1.5 pt-4 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-ivory-100/40 hover:text-ivory-100/70">
                {t(`groups.${g.key}`)}
                <ChevronDown className={cn("size-3 transition-transform", collapsed[g.key] && "-rotate-90 rtl:rotate-90")} aria-hidden />
              </button>
            )}
            {!collapsed[g.key] && (
              <ul className="space-y-0.5">
                {g.items.map((i) => (
                  <li key={i.href}>
                    <Link href={i.href} aria-current={isActive(i.href) ? "page" : undefined} className={cn("group flex h-9 items-center gap-3 rounded-md px-2.5 text-[0.88rem] transition-colors", isActive(i.href) ? "bg-gold-400/15 text-gold-200 ring-1 ring-gold-400/25" : "text-ivory-100/70 hover:bg-ivory-50/[0.06] hover:text-ivory-50")}>
                      <i.icon className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
                      <span className="flex-1 truncate">{t(i.key)}</span>
                      {!!i.badge && <span className="grid min-w-5 place-items-center rounded-full bg-oxblood-600 px-1.5 text-[0.65rem] font-bold text-ivory-50">{i.badge}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-ivory-50/10 p-3">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <span className="grid size-8 place-items-center rounded-full bg-gold-400/20 text-sm font-semibold text-gold-200">{(session.displayName ?? session.email)[0]?.toUpperCase()}</span>
          <div className="min-w-0 flex-1 text-xs">
            <p className="truncate text-ivory-50">{session.displayName ?? session.email}</p>
            <p className="truncate text-ivory-100/50">{session.roles.filter((r) => r !== "customer").map((r) => t(`roles.${r}`)).join(" · ")}</p>
          </div>
          <button type="button" onClick={async () => { await signOut(); window.location.href = `/${locale}`; }} className="grid size-8 place-items-center rounded-md text-ivory-100/60 hover:bg-ivory-50/10 hover:text-ivory-50" aria-label={t("signOut")}>
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </nav>
  );

  return (
    <div className="min-h-dvh bg-ivory-100 lg:grid lg:grid-cols-[16.5rem_1fr]">
      {/* Sidebar scrolls independently; main page scrolls with the document → no double scroll */}
      <aside className="tex-night sticky top-0 hidden h-dvh lg:block">{nav}</aside>
      {mobile && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-midnight-950/60" aria-label={t("close")} onClick={() => setMobile(false)} />
          <aside className="tex-night absolute inset-y-0 start-0 w-72 shadow-lift">{nav}</aside>
        </div>
      )}
      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--line)] bg-ivory-100/90 px-4 backdrop-blur-lg sm:px-6">
          <button type="button" className="grid size-9 place-items-center rounded-md hover:bg-stone-100 lg:hidden" aria-label={t("menu")} onClick={() => setMobile(true)}>
            {mobile ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
          {demo && <span className="rounded-[3px] border border-dashed border-ochre-600/60 bg-ochre-100 px-2 py-0.5 font-mono text-[0.65rem] font-semibold tracking-[0.14em] text-ochre-600">{t("demo")}</span>}
          <div className="ms-auto flex items-center gap-1">
            <LanguageMenu dark={false} />
            <Link href="/" className="rounded-md px-3 py-1.5 text-sm text-charcoal-600 hover:bg-stone-100">
              {t("toSite")}
            </Link>
          </div>
        </header>
        <main id="main" className="mx-auto w-full max-w-[96rem] px-4 pb-24 pt-6 sm:px-6 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
