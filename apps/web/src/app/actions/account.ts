"use server";

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { favoriteGraves, graves, openSealed, orders, savedPeople, seal, sessions, userConsents, users } from "@kvittel/db";
import { personSchema } from "@/lib/kvittel-schema";
import { audit } from "@/server/audit";
import { destroySession, requireUser } from "@/server/auth/session";
import { getDb } from "@/server/db";

/** Guest orders become account orders only after the email was proven by magic link. */
export async function claimGuestOrders() {
  const u = await requireUser();
  const db = await getDb();
  const r = await db.update(orders).set({ userId: u.id }).where(and(eq(orders.email, u.email), isNull(orders.userId))).returning({ id: orders.id });
  await audit({ actorUserId: u.id, action: "account.claim_guest_orders", meta: { count: r.length } });
  return { ok: true, count: r.length };
}

const savedSchema = z.object({ groupName: z.string().trim().min(1).max(60), people: z.array(personSchema).min(1).max(40), consent: z.literal(true) });

export async function saveNamesGroup(input: unknown) {
  const u = await requireUser();
  const parsed = savedSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const };
  const db = await getDb();
  await db.insert(savedPeople).values({ userId: u.id, groupName: parsed.data.groupName, contentEnc: seal(JSON.stringify(parsed.data.people), `saved:${u.id}`) });
  await db.insert(userConsents).values({ userId: u.id, email: u.email, kind: "save_names_cloud", granted: true, source: "account.names" });
  return { ok: true as const };
}

export async function listNamesGroups() {
  const u = await requireUser();
  const db = await getDb();
  const rows = await db.select().from(savedPeople).where(eq(savedPeople.userId, u.id));
  return rows.map((r) => ({ id: r.id, groupName: r.groupName, people: JSON.parse(openSealed(r.contentEnc, `saved:${u.id}`).toString("utf8")) as z.infer<typeof personSchema>[] }));
}

export async function deleteNamesGroup(id: string) {
  const u = await requireUser();
  const db = await getDb();
  await db.delete(savedPeople).where(and(eq(savedPeople.id, id), eq(savedPeople.userId, u.id)));
  return { ok: true };
}

export async function toggleFavorite(slug: string) {
  const u = await requireUser();
  const db = await getDb();
  const [g] = await db.select({ id: graves.id }).from(graves).where(eq(graves.slug, slug));
  if (!g) return { ok: false };
  const del = await db.delete(favoriteGraves).where(and(eq(favoriteGraves.userId, u.id), eq(favoriteGraves.graveId, g.id))).returning();
  if (!del.length) await db.insert(favoriteGraves).values({ userId: u.id, graveId: g.id });
  return { ok: true, favorite: !del.length };
}

export async function updatePreferences(input: { locale?: string; currency?: string; marketing?: boolean }) {
  const u = await requireUser();
  const db = await getDb();
  const set: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (input.locale && /^[a-z]{2}$/.test(input.locale)) set.locale = input.locale;
  if (input.currency && /^[A-Z]{3}$/.test(input.currency)) set.currency = input.currency;
  await db.update(users).set(set).where(eq(users.id, u.id));
  if (typeof input.marketing === "boolean") await db.insert(userConsents).values({ userId: u.id, email: u.email, kind: "marketing_email", granted: input.marketing, source: "account.settings" });
  return { ok: true };
}

/** GDPR-style export of personal data we hold (saved names decrypted for their owner only). */
export async function exportMyData() {
  const u = await requireUser();
  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.id, u.id));
  const myOrders = await db.select({ ref: orders.publicRef, status: orders.status, total: orders.totalMinor, currency: orders.currency, createdAt: orders.createdAt }).from(orders).where(eq(orders.userId, u.id));
  const consents = await db.select().from(userConsents).where(eq(userConsents.userId, u.id));
  await audit({ actorUserId: u.id, action: "account.export" });
  return { exportedAt: new Date().toISOString(), user: { email: user?.email, locale: user?.locale, currency: user?.currency, createdAt: user?.createdAt }, orders: myOrders, consents: consents.map((c) => ({ kind: c.kind, granted: c.granted, at: c.createdAt })), savedNames: await listNamesGroups() };
}

/** Deletion: personal records removed/anonymised; financial records keep only what law requires. */
export async function deleteMyAccount(confirmEmail: string) {
  const u = await requireUser();
  if (confirmEmail.trim().toLowerCase() !== u.email) return { ok: false };
  const db = await getDb();
  await db.delete(savedPeople).where(eq(savedPeople.userId, u.id));
  await db.delete(favoriteGraves).where(eq(favoriteGraves.userId, u.id));
  await db.delete(sessions).where(eq(sessions.userId, u.id));
  await db.update(users).set({ email: `deleted+${u.id}@invalid`, displayName: null, deletedAt: new Date() }).where(eq(users.id, u.id));
  await audit({ actorUserId: u.id, action: "account.deleted" });
  await destroySession();
  return { ok: true };
}
