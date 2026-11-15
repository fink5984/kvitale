"use server";

import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { graveRequests, graves, payments, users, roleAssignments } from "@kvittel/db";
import type { KvittelContent } from "@kvittel/print-layout";
import { routing } from "@/i18n/routing";
import { checkoutSchema, cartEntrySchema, kvittelContentSchema } from "@/lib/kvittel-schema";
import { audit } from "@/server/audit";
import { consumeMagicCode, consumeMagicToken, createMagicLink, createSession, destroySession, findOrCreateUser, getSession } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { sendMagicLink } from "@/server/email";
import { env } from "@/server/env";
import { createOrder, type CreateOrderResult } from "@/server/orders";
import { mockSign } from "@/server/payments/mock";
import { quote } from "@/server/pricing";
import { renderServer } from "@/server/print";
import { rateLimit } from "@/server/ratelimit";

async function clientKey() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
}

export async function registerDemand(slug: string) {
  if (!rateLimit(`demand:${await clientKey()}:${slug}`, 1, 86400000).ok) return { ok: true };
  const db = await getDb();
  await db.update(graves).set({ demandCount: sql`${graves.demandCount} + 1` }).where(eq(graves.slug, slug));
  return { ok: true };
}

const requestSchema = z.object({ name: z.string().trim().min(2).max(160), location: z.string().trim().max(200).optional(), email: z.email().max(200).optional().or(z.literal("")), locale: z.string().max(5), website: z.string().max(0).optional() });

export async function requestGrave(input: z.infer<typeof requestSchema>) {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "invalid" };
  if (!rateLimit(`graverequest:${await clientKey()}`, 5, 3600000).ok) return { ok: false as const, error: "rate_limited" };
  const db = await getDb();
  await db.insert(graveRequests).values({ nameText: parsed.data.name, locationText: parsed.data.location || null, email: parsed.data.email || null, locale: parsed.data.locale });
  return { ok: true as const };
}

/** Authoritative server validation for the builder (page count, unsupported glyphs, limits). */
export async function validateKvittel(content: unknown) {
  const parsed = kvittelContentSchema.safeParse(content);
  if (!parsed.success) return { ok: false as const, warnings: [{ code: "invalid", blocking: true }], pages: 0 };
  const r = await renderServer(parsed.data as KvittelContent);
  return { ok: !r.layout.warnings.some((w) => w.blocking), warnings: r.layout.warnings, pages: r.layout.pages.length, lengthMm: r.layout.totalLengthMm };
}

export async function quoteCart(input: { entries: unknown[]; currency: string; coupon?: string }) {
  const entries = z.array(cartEntrySchema).max(10).safeParse(input.entries);
  if (!entries.success) return { ok: false as const, error: "invalid" };
  if (!rateLimit(`quote:${await clientKey()}`, 60, 60000).ok) return { ok: false as const, error: "rate_limited" };
  const items: Array<{ entryId: string; graveSlug: string; pages: number }> = [];
  for (const e of entries.data) {
    const r = await renderServer(e.content as KvittelContent);
    for (const slug of e.graveSlugs) items.push({ entryId: e.id, graveSlug: slug, pages: r.layout.pages.length });
  }
  try {
    const q = await quote(input.currency, items, input.coupon);
    return { ok: true as const, quote: q };
  } catch {
    return { ok: false as const, error: "pricing_unavailable" };
  }
}

export async function checkout(input: unknown): Promise<CreateOrderResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "kvittel_invalid", detail: "validation" };
  if (!rateLimit(`checkout:${await clientKey()}`, 10, 600000).ok) return { ok: false, error: "rate_limited" };
  const session = await getSession();
  try {
    return await createOrder(parsed.data, { userId: session?.id ?? null });
  } catch (e) {
    console.error("checkout_failed", (e as Error).message);
    return { ok: false, error: "server_error" };
  }
}

/**
 * DEMO payment page actions. They do not mark anything paid directly: they
 * emit a signed webhook to our own endpoint — the same path a real provider uses.
 */
export async function demoPay(providerRef: string, outcome: "succeed" | "decline" | "replay") {
  if (!env.demoMode) return { ok: false as const };
  const db = await getDb();
  const [p] = await db.select().from(payments).where(and(eq(payments.provider, "mock"), eq(payments.providerRef, providerRef))).limit(1);
  if (!p) return { ok: false as const };
  const eventId = outcome === "replay" ? `evt_${providerRef}_succeeded` : `evt_${providerRef}_${outcome === "succeed" ? "succeeded" : "failed"}`;
  const body = JSON.stringify({ id: eventId, type: outcome === "decline" ? "payment.failed" : "payment.succeeded", data: { providerRef, amountMinor: p.amountMinor, currency: p.currency } });
  const res = await fetch(`${env.appUrl}/api/webhooks/payments/mock`, { method: "POST", headers: { "content-type": "application/json", "x-kvittel-mock-signature": mockSign(body) }, body });
  const json = (await res.json().catch(() => ({}))) as { outcome?: string };
  return { ok: res.ok, outcome: json.outcome ?? "error" };
}

/* ───────────── auth ───────────── */

export async function requestMagicLink(input: { email: string; locale: string; next?: string }) {
  const email = z.email().max(200).safeParse(input.email?.trim());
  if (!email.success) return { ok: false as const, error: "invalid_email" };
  const ip = await clientKey();
  if (!rateLimit(`magic:${ip}`, 8, 3600000).ok || !rateLimit(`magic:${email.data.toLowerCase()}`, 5, 3600000).ok) return { ok: false as const, error: "rate_limited" };
  const locale = (routing.locales as readonly string[]).includes(input.locale) ? input.locale : "he";
  const next = input.next && input.next.startsWith("/") && !input.next.startsWith("//") ? input.next : null;
  const { token, code } = await createMagicLink(email.data, next);
  await sendMagicLink(email.data.toLowerCase(), locale, `${env.appUrl}/${locale}/login/verify?token=${token}`, code);
  return { ok: true as const };
}

export async function verifyMagicCode(input: { email: string; code: string; locale: string }) {
  if (!rateLimit(`verify:${await clientKey()}`, 20, 3600000).ok) return { ok: false as const, error: "rate_limited" };
  const row = await consumeMagicCode(input.email, input.code);
  if (!row) return { ok: false as const, error: "invalid_code" };
  const user = await findOrCreateUser(row.email, input.locale);
  await createSession(user.id, (await headers()).get("user-agent"));
  return { ok: true as const, next: row.redirectTo ?? "/account" };
}

export async function verifyMagicToken(token: string, locale: string) {
  const row = await consumeMagicToken(token);
  if (!row) return { ok: false as const };
  const user = await findOrCreateUser(row.email, locale);
  await createSession(user.id, (await headers()).get("user-agent"));
  return { ok: true as const, next: row.redirectTo ?? "/account" };
}

/** DEMO-only quick sign-in as a seeded role. Disabled outside demo mode. */
export async function demoSignIn(email: string) {
  if (!env.demoMode || !email.endsWith("@demo.kvittel.local")) return { ok: false as const };
  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u) return { ok: false as const };
  await createSession(u.id, "demo-signin");
  const roles = await db.select({ role: roleAssignments.role }).from(roleAssignments).where(eq(roleAssignments.userId, u.id));
  await audit({ actorUserId: u.id, action: "auth.demo_sign_in" });
  const r = roles.map((x) => x.role);
  return { ok: true as const, next: r.some((x) => ["super_admin", "admin", "finance", "support_limited", "content_editor"].includes(x)) ? "/admin" : r.some((x) => ["partner_manager", "local_maintainer"].includes(x)) ? "/operator" : "/account" };
}

export async function signOut() {
  await destroySession();
  return { ok: true };
}
