import { desc, eq, or } from "drizzle-orm";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { favoriteGraves, graves, graveTranslations, orders } from "@kvittel/db";
import { ClaimPanel, NamesPanel, SettingsPanel } from "@/components/site/AccountPanels";
import { Badge, EmptyState, buttonClass } from "@/components/ui";
import { Link, redirect } from "@/i18n/navigation";
import { formatDate, formatMoney } from "@/lib/format";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await getSession();
  if (!s) return redirect({ href: "/login?next=/account", locale });
  const t = await getTranslations("account.dashboard");
  const ts = await getTranslations("status.order");
  const db = await getDb();
  const myOrders = await db.select().from(orders).where(or(eq(orders.userId, s.id), eq(orders.email, s.email))).orderBy(desc(orders.createdAt)).limit(50);
  const unclaimed = myOrders.filter((o) => !o.userId).length;
  const favs = await db.select({ slug: graves.slug, graveId: graves.id }).from(favoriteGraves).innerJoin(graves, eq(graves.id, favoriteGraves.graveId)).where(eq(favoriteGraves.userId, s.id));
  const favNames = favs.length ? await db.select().from(graveTranslations) : [];

  return (
    <div className="mx-auto max-w-6xl px-[var(--gutter)] pb-28 pt-12 sm:pt-16">
      <p className="eyebrow text-gold-700">{t("eyebrow")}</p>
      <h1 className="font-display mt-3 text-[clamp(2.4rem,5vw,4rem)] leading-[1.02] text-midnight-900">{t("title", { name: s.displayName ?? s.email.split("@")[0]! })}</h1>
      {s.roles.some((r) => r !== "customer") && (
        <div className="mt-6 flex flex-wrap gap-2">
          {s.permissions.has("admin.access") && <Link href="/admin" className={buttonClass("outline", "sm")}>{t("toAdmin")}</Link>}
          {s.permissions.has("operator.access") && <Link href="/operator" className={buttonClass("outline", "sm")}>{t("toOperator")}</Link>}
        </div>
      )}
      <div className="mt-12 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="orders">
          <div className="flex items-center justify-between">
            <h2 id="orders" className="font-display text-3xl text-midnight-900">{t("orders")}</h2>
            <Link href="/write" className={buttonClass("primary", "sm")}>{t("newKvittel")}</Link>
          </div>
          {myOrders.length === 0 ? (
            <div className="mt-6"><EmptyState title={t("noOrders")} body={t("noOrdersBody")} /></div>
          ) : (
            <ul className="mt-6 divide-y divide-[var(--line)] rounded-xl border border-[var(--line)] bg-[var(--surface)]">
              {myOrders.map((o) => (
                <li key={o.id}>
                  <Link href={`/order/${o.publicRef}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-ivory-200/60">
                    <span>
                      <span className="font-mono text-sm"><bdi>{o.publicRef}</bdi></span>
                      <span className="ms-3 text-sm text-charcoal-500">{formatDate(o.createdAt, locale)}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <Badge tone={o.status === "fulfilled" ? "success" : o.status === "attention" ? "danger" : "neutral"}>{ts(o.status)}</Badge>
                      <span className="tabular">{formatMoney(o.totalMinor, o.currency, locale)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {unclaimed > 0 && <ClaimPanel count={unclaimed} />}
        </section>
        <div className="space-y-10">
          <NamesPanel />
          <section aria-labelledby="favs">
            <h2 id="favs" className="font-display text-2xl text-midnight-900">{t("favorites")}</h2>
            {favs.length === 0 ? <p className="mt-3 text-sm text-charcoal-500">{t("noFavorites")}</p> : (
              <ul className="mt-3 space-y-2">
                {favs.map((f) => {
                  const n = favNames.find((x) => x.graveId === f.graveId && x.locale === locale) ?? favNames.find((x) => x.graveId === f.graveId);
                  return <li key={f.slug}><Link href={`/graves/${f.slug}`} className="underline-offset-4 hover:underline"><bdi>{n?.name ?? f.slug}</bdi></Link></li>;
                })}
              </ul>
            )}
          </section>
          <SettingsPanel email={s.email} />
        </div>
      </div>
    </div>
  );
}
