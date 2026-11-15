import "server-only";
import { createTranslator } from "next-intl";
import { outboundEmails } from "@kvittel/db";
import { loadMessages } from "@/i18n/request";
import { dirOf } from "@/i18n/locales";
import { getDb } from "../db";
import { env } from "../env";

/**
 * Mail provider adapter. `devmailbox` stores mails in the DB and shows them at
 * /{locale}/dev/mailbox (DEMO only). SMTP / Resend adapters plug in here.
 */
interface MailProvider {
  id: string;
  send(m: { to: string; subject: string; html: string; text: string; template: string; locale: string }): Promise<void>;
}

const devMailbox: MailProvider = {
  id: "devmailbox",
  async send(m) {
    const db = await getDb();
    await db.insert(outboundEmails).values({ ...m, provider: "devmailbox", status: "delivered_to_dev_mailbox" });
  },
};

/**
 * Resend (HTTPS API, no SDK). Requires RESEND_API_KEY and MAIL_FROM (a verified sender).
 * Message bodies never contain kvittel content — only order references and tracking links.
 */
const resend: MailProvider = {
  id: "resend",
  async send(m) {
    const db = await getDb();
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${env.resendApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: env.mailFrom, to: [m.to], subject: m.subject, html: m.html, text: m.text }),
    });
    await db.insert(outboundEmails).values({ ...m, html: "", text: "", provider: "resend", status: res.ok ? "sent" : `failed_${res.status}` });
    if (!res.ok) throw new Error(`resend_${res.status}`);
  },
};

/** The dev mailbox exists only in an explicit local DEMO. Otherwise a real provider is required — no silent fallback. */
function provider(): MailProvider {
  if (env.demoMode && env.mailProvider === "devmailbox") return devMailbox;
  if (env.mailProvider === "resend" && env.resendApiKey && env.mailFrom) return resend;
  throw new Error("mail_unavailable");
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(locale: string, title: string, bodyHtml: string, footer: string) {
  const dir = dirOf(locale);
  return `<!doctype html><html lang="${locale}" dir="${dir}"><body style="margin:0;background:#F5EFE2;font-family:Georgia,'Times New Roman',serif;color:#0F1D33">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FBF8F1;border:1px solid #D9CDB4;border-radius:4px">
<tr><td style="background:#12203F;padding:28px 32px;text-align:center;color:#E3CB8F;font-size:13px;letter-spacing:.2em">KVITALE · קוויטלה</td></tr>
<tr><td style="padding:32px;text-align:${dir === "rtl" ? "right" : "left"}"><h1 style="font-weight:normal;font-size:26px;margin:0 0 16px">${esc(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:20px 32px;border-top:1px solid #E8DFCC;color:#6B645A;font-size:12px;text-align:center;font-family:Arial,sans-serif">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

type Tr = (key: string, values?: Record<string, string | number>) => string;
async function t(locale: string): Promise<Tr> {
  const messages = await loadMessages(locale);
  return createTranslator({ locale, messages: messages as never, namespace: "email" as never }) as unknown as Tr;
}

const button = (href: string, label: string) =>
  `<p style="margin:28px 0"><a href="${esc(href)}" style="background:#0F1D33;color:#FBF8F1;text-decoration:none;padding:14px 26px;border-radius:999px;font-family:Arial,sans-serif;font-size:15px">${esc(label)}</a></p>`;

export async function sendMagicLink(to: string, locale: string, link: string, code: string) {
  const tr = await t(locale);
  const subject = tr("magic.subject");
  const html = layout(locale, tr("magic.title"), `<p style="font-size:16px;line-height:1.6">${esc(tr("magic.body"))}</p>${button(link, tr("magic.cta"))}<p style="font-size:14px;color:#3A3631">${esc(tr("magic.code"))}</p><p style="font-size:30px;letter-spacing:.3em;font-family:monospace;margin:4px 0 20px">${esc(code)}</p><p style="font-size:13px;color:#6B645A">${esc(tr("magic.ignore"))}</p>`, tr("footer"));
  await provider().send({ to, subject, html, text: `${tr("magic.body")}\n${link}\n${tr("magic.code")} ${code}`, template: "magic_link", locale });
}

export async function sendOrderConfirmation(to: string, locale: string, data: { ref: string; trackUrl: string; total: string; graves: string[]; scheduled: boolean }) {
  const tr = await t(locale);
  const list = data.graves.map((g) => `<li style="margin:4px 0"><bdi>${esc(g)}</bdi></li>`).join("");
  const html = layout(
    locale,
    tr("order.title"),
    `<p style="font-size:16px;line-height:1.6">${esc(tr("order.body"))}</p><p style="font-size:14px;color:#3A3631">${esc(tr("order.ref"))} <bdi style="font-family:monospace">${esc(data.ref)}</bdi> · ${esc(data.total)}</p><ul style="padding-inline-start:20px">${list}</ul>${data.scheduled ? `<p style="font-size:14px;background:#F5EFE2;padding:12px;border-radius:4px">${esc(tr("order.scheduled"))}</p>` : ""}${button(data.trackUrl, tr("order.cta"))}<p style="font-size:13px;color:#6B645A">${esc(tr("order.privacy"))}</p>`,
    tr("footer"),
  );
  await provider().send({ to, subject: tr("order.subject", { ref: data.ref }), html, text: `${tr("order.body")}\n${data.trackUrl}`, template: "order_confirmation", locale });
}

export async function sendDeliveryUpdate(to: string, locale: string, data: { ref: string; trackUrl: string; grave: string; status: "delivered" | "uncertain" | "failed" }) {
  const tr = await t(locale);
  const html = layout(locale, tr(`delivery.${data.status}.title`), `<p style="font-size:16px;line-height:1.6">${esc(tr(`delivery.${data.status}.body`, { grave: data.grave }))}</p>${button(data.trackUrl, tr("order.cta"))}`, tr("footer"));
  await provider().send({ to, subject: tr(`delivery.${data.status}.subject`, { ref: data.ref }), html, text: tr(`delivery.${data.status}.body`, { grave: data.grave }), template: `delivery_${data.status}`, locale });
}
