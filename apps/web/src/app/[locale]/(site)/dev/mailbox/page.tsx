import { desc } from "drizzle-orm";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { outboundEmails } from "@kvittel/db";
import { formatDateTime } from "@/lib/format";
import { getDb } from "@/server/db";
import { env } from "@/server/env";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false } };

/** DEMO only: shows emails captured by the dev mailbox provider instead of sending them. */
export default async function Mailbox({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!env.demoMode) notFound();
  const db = await getDb();
  const mails = await db.select().from(outboundEmails).orderBy(desc(outboundEmails.createdAt)).limit(30);
  return (
    <div className="mx-auto max-w-5xl px-[var(--gutter)] pb-24 pt-12">
      <p className="font-mono text-xs font-semibold tracking-[0.15em] text-ochre-600">DEMO · DEV MAILBOX</p>
      <h1 className="font-display mt-2 text-4xl">Outbound email (not sent)</h1>
      <ul className="mt-8 space-y-6">
        {mails.map((m) => (
          <li key={m.id} className="overflow-hidden rounded-xl border border-[var(--line)] bg-ivory-50" data-testid="mail">
            <div className="flex flex-wrap justify-between gap-2 border-b border-[var(--line)] px-5 py-3 text-sm">
              <span>
                <b>{m.subject}</b> → <span dir="ltr" data-testid="mail-to">{m.to}</span>
              </span>
              <span className="text-charcoal-500">
                {m.template} · {m.locale} · {formatDateTime(m.createdAt, locale)}
              </span>
            </div>
            <iframe title={m.subject} srcDoc={m.html} sandbox="" className="h-[28rem] w-full bg-white" />
            <pre className="hidden" data-testid="mail-text">{m.text}</pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
