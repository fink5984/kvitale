import { and, count, ne } from "drizzle-orm";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { alerts } from "@kvittel/db";
import { AdminShell } from "@/components/admin/Shell";
import { serializeSession } from "@/server/admin-guard";
import { getSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const s = await getSession();
  if (!s) redirect(`/${locale}/login?next=/admin`);
  if (!s.permissions.has("admin.access")) redirect(s.permissions.has("operator.access") ? `/${locale}/operator` : `/${locale}/account`);
  const db = await getDb();
  const [{ n }] = (await db.select({ n: count() }).from(alerts).where(and(ne(alerts.status, "resolved")))) as [{ n: number }];
  const all = await getMessages();
  const messages = Object.fromEntries(Object.entries(all).filter(([k]) => ["common", "status", "admin", "lab", "validation", "builder"].includes(k)));
  return (
    <NextIntlClientProvider messages={messages}>
      <AdminShell session={serializeSession(s)} openAlerts={Number(n)} demo={env.demoMode}>
        {children}
      </AdminShell>
    </NextIntlClientProvider>
  );
}
