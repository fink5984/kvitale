import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense, type ReactNode } from "react";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { Link } from "@/i18n/navigation";
import { getSession } from "@/server/auth/session";
import { env } from "@/server/env";
import { getCurrency } from "@/server/prefs";

export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [currency, session, t] = await Promise.all([getCurrency(locale), getSession(), getTranslations("common")]);
  return (
    <>
      <Suspense>
        <Header
          currency={currency}
          signedIn={!!session}
          banner={
            env.demoMode ? (
              <div className="h-7 truncate bg-ochre-100 px-4 py-1.5 text-center text-[0.75rem] leading-4 text-ochre-600">
                <span className="font-mono font-semibold tracking-[0.14em]">DEMO</span> · {t("demo.banner")}{" "}
                <Link href="/legal/delivery-disclosure" className="underline underline-offset-2">
                  {t("demo.learn")}
                </Link>
              </div>
            ) : undefined
          }
        />
      </Suspense>
      <main id="main">{children}</main>
      <Footer demo={env.demoMode} />
    </>
  );
}
