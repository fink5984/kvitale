import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";
import type { PaymentProvider } from "./types";

/**
 * Stripe Checkout adapter (REST, no SDK). STATUS: implemented against Stripe's
 * documented API but NOT exercised — requires STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
 * and a business decision that Stripe supports the operating entity & countries.
 */
const ZERO_DECIMAL = new Set<string>([]);

async function stripe(path: string, form: Record<string, string>) {
  if (!env.stripeSecretKey) throw new Error("STRIPE_SECRET_KEY missing");
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${env.stripeSecretKey}`, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw new Error(`stripe ${path} ${res.status}`);
  return json;
}

export const stripeProvider: PaymentProvider = {
  id: "stripe",
  isDemo: false,
  async createCheckout(req) {
    const s = await stripe("/checkout/sessions", {
      mode: "payment",
      customer_email: req.email,
      client_reference_id: req.orderId,
      success_url: req.successUrl,
      cancel_url: req.cancelUrl,
      locale: ["he", "en", "fr", "ru"].includes(req.locale) ? req.locale : "auto",
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": req.currency.toLowerCase(),
      "line_items[0][price_data][unit_amount]": String(ZERO_DECIMAL.has(req.currency) ? Math.round(req.amountMinor / 100) : req.amountMinor),
      "line_items[0][price_data][product_data][name]": `Kvittel order ${req.ref}`,
      "metadata[order_ref]": req.ref,
    });
    return { providerRef: String(s.id), redirectUrl: String(s.url) };
  },
  async verifyWebhook(rawBody, headers) {
    if (!env.stripeWebhookSecret) return null;
    const h = headers.get("stripe-signature") ?? "";
    const items = h.split(",").map((p) => p.split("="));
    const t = items.find(([k]) => k === "t")?.[1];
    const sigs = items.filter(([k]) => k === "v1").map(([, v]) => v!);
    if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 300) return null;
    const expected = createHmac("sha256", env.stripeWebhookSecret).update(`${t}.${rawBody}`).digest();
    if (!sigs.some((s) => { const b = Buffer.from(s, "hex"); return b.length === expected.length && timingSafeEqual(b, expected); })) return null;
    const ev = JSON.parse(rawBody) as { id: string; type: string; data: { object: { id: string; amount_total?: number; currency?: string; payment_status?: string } } };
    const o = ev.data.object;
    const type = ev.type === "checkout.session.completed" && o.payment_status === "paid" ? "payment.succeeded" : ev.type === "checkout.session.async_payment_failed" ? "payment.failed" : "other";
    return { eventId: ev.id, type, providerRef: o.id, amountMinor: o.amount_total ?? null, currency: o.currency?.toUpperCase() ?? null };
  },
  async refund() {
    // Requires payment_intent lookup from the checkout session; intentionally not enabled until credentials exist.
    return { ok: false, refundRef: "", error: "stripe_refunds_not_configured" };
  },
};
