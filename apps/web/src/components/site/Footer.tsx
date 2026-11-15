import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/brand/Logo";
import { Ornament } from "@/components/ui";
import { Link } from "@/i18n/navigation";

export async function Footer({ demo }: { demo: boolean }) {
  const t = await getTranslations("common");
  const cols = [
    { title: t("footer.service"), links: [["/graves", t("nav.graves")], ["/write", t("cta.write")], ["/how-it-works", t("nav.howItWorks")], ["/request-grave", t("footer.requestGrave")]] },
    { title: t("footer.trust"), links: [["/legal/delivery-disclosure", t("footer.disclosure")], ["/legal/privacy", t("footer.privacy")], ["/legal/refunds", t("footer.refunds")], ["/legal/terms", t("footer.terms")]] },
    { title: t("footer.account"), links: [["/login", t("nav.signIn")], ["/account", t("nav.account")], ["/faq", t("nav.faq")], ["/operator", t("footer.operators")]] },
  ];
  return (
    <footer className="tex-night relative overflow-hidden text-ivory-100">
      <div className="pointer-events-none absolute -top-40 start-1/2 h-80 w-[50rem] -translate-x-1/2 rounded-full bg-gold-400/10 blur-3xl rtl:translate-x-1/2" aria-hidden />
      <div className="relative mx-auto max-w-[88rem] px-[var(--gutter)] pb-10 pt-20">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-sm">
            <div className="flex items-center gap-3">
              <LogoMark className="h-11 w-9" tone="light" />
              <span className="font-display text-3xl text-ivory-50">{t("brand")}</span>
            </div>
            <p className="mt-5 text-[0.95rem] leading-relaxed text-ivory-100/65">{t("footer.mission")}</p>
            <p className="mt-6 text-xs leading-relaxed text-ivory-100/45">{t("footer.disclaimer")}</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <h2 className="eyebrow text-gold-300/90">{c.title}</h2>
              <ul className="mt-5 space-y-3">
                {c.links.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href!} className="text-[0.95rem] text-ivory-100/75 transition-colors hover:text-gold-200">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <Ornament className="mt-16 text-gold-500/60" />
        <div className="mt-8 flex flex-col items-center justify-between gap-4 text-xs text-ivory-100/45 sm:flex-row">
          <p>© {new Date().getFullYear()} {t("brand")} · {t("footer.workingName")}</p>
          {demo && <p className="font-mono tracking-wider text-ochre-100/70">{t("demo.footer")}</p>}
        </div>
      </div>
    </footer>
  );
}
