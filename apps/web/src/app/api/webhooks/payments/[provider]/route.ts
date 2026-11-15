import { NextResponse } from "next/server";
import { sha256 } from "@kvittel/db";
import { audit } from "@/server/audit";
import { processPaymentEvent } from "@/server/orders";
import { providerById } from "@/server/payments";

/** Signed + idempotent. The only code path that marks an order as paid. */
export async function POST(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await ctx.params;
  const provider = providerById(id);
  if (!provider) return NextResponse.json({ error: "unknown_provider" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 256_000) return NextResponse.json({ error: "too_large" }, { status: 413 });
  const ev = await provider.verifyWebhook(raw, req.headers);
  if (!ev) {
    await audit({ actorKind: "webhook", action: "payment.webhook.invalid_signature", meta: { provider: id } });
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  const r = await processPaymentEvent(id, ev, sha256(raw));
  return NextResponse.json({ received: true, outcome: r.outcome });
}
