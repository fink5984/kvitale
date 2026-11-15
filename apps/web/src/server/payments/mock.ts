import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { randomToken, secret } from "@kvittel/db";
import type { PaymentProvider, VerifiedEvent } from "./types";

/**
 * DEMO payment provider. No card data is ever collected. The hosted "payment
 * page" lives at /[locale]/pay/demo/[ref] and the confirmation arrives through
 * the same signed, idempotent webhook path a real provider would use.
 */
const TOLERANCE_S = 300;

export function mockSign(body: string, ts = Math.floor(Date.now() / 1000)): string {
  const sig = createHmac("sha256", secret("PAYMENT_WEBHOOK_SECRET")).update(`${ts}.${body}`).digest("hex");
  return `t=${ts},v1=${sig}`;
}

export const mockProvider: PaymentProvider = {
  id: "mock",
  isDemo: true,
  async createCheckout(req) {
    const providerRef = `mock_cs_${randomToken(12)}`;
    return { providerRef, redirectUrl: `/${req.locale}/pay/demo/${providerRef}` };
  },
  async verifyWebhook(rawBody, headers) {
    const h = headers.get("x-kvittel-mock-signature") ?? "";
    const parts = Object.fromEntries(h.split(",").map((p) => p.split("=") as [string, string]));
    const ts = Number(parts.t);
    if (!ts || !parts.v1 || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_S) return null;
    const expected = createHmac("sha256", secret("PAYMENT_WEBHOOK_SECRET")).update(`${ts}.${rawBody}`).digest();
    const got = Buffer.from(parts.v1, "hex");
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    const ev = JSON.parse(rawBody) as { id: string; type: VerifiedEvent["type"]; data: { providerRef: string; amountMinor: number; currency: string } };
    return { eventId: ev.id, type: ev.type, providerRef: ev.data.providerRef, amountMinor: ev.data.amountMinor, currency: ev.data.currency };
  },
  async refund(_ref, _amount) {
    return { ok: true, refundRef: `mock_re_${randomToken(8)}` };
  },
};
