import "server-only";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { magicLinks, partnerGraves, randomToken, roleAssignments, sessions, sha256, users } from "@kvittel/db";
import { getDb } from "../db";
import { permissionsFor, SCOPED_ROLES, type Permission, type Role } from "../rbac";
import { env } from "../env";
import { audit } from "../audit";

export const SESSION_COOKIE = "kv_session";
const SESSION_DAYS = 30;

export interface SessionUser {
  id: string;
  email: string;
  displayName: string | null;
  locale: string;
  currency: string;
  roles: Role[];
  permissions: Set<Permission>;
  /** null = unscoped; otherwise only these grave ids */
  graveScope: string[] | null;
  isDemo: boolean;
}

export const getSession = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const db = await getDb();
  const rows = await db
    .select({ user: users, session: sessions })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256(raw)), gt(sessions.expiresAt, new Date()), isNull(users.deletedAt)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const ra = await db.select().from(roleAssignments).where(and(eq(roleAssignments.userId, row.user.id), isNull(roleAssignments.revokedAt)));
  const roles = [...new Set(ra.map((r) => r.role as Role))];
  if (!roles.includes("customer")) roles.push("customer");
  let graveScope: string[] | null = null;
  const unscoped = roles.some((r) => !SCOPED_ROLES.includes(r) && r !== "customer");
  if (!unscoped) {
    const partnerIds = ra.filter((r) => r.partnerId).map((r) => r.partnerId!);
    graveScope = [];
    for (const pid of partnerIds) {
      const pg = await db.select({ graveId: partnerGraves.graveId }).from(partnerGraves).where(eq(partnerGraves.partnerId, pid));
      graveScope.push(...pg.map((x) => x.graveId));
    }
  }
  return {
    id: row.user.id,
    email: row.user.email,
    displayName: row.user.displayName,
    locale: row.user.locale,
    currency: row.user.currency,
    roles,
    permissions: permissionsFor(roles),
    graveScope,
    isDemo: row.user.isDemo,
  };
});

export class AuthError extends Error {
  constructor(public code: "unauthenticated" | "forbidden") {
    super(code);
  }
}

export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new AuthError("unauthenticated");
  return s;
}

export async function requirePermission(p: Permission): Promise<SessionUser> {
  const s = await requireUser();
  if (!s.permissions.has(p)) throw new AuthError("forbidden");
  return s;
}

export function can(s: SessionUser | null, p: Permission) {
  return !!s && s.permissions.has(p);
}

/** Scoped roles may only touch graves of their partner. */
export function assertGraveScope(s: SessionUser, graveId: string) {
  if (s.graveScope && !s.graveScope.includes(graveId)) throw new AuthError("forbidden");
}

export async function createSession(userId: string, userAgent?: string | null) {
  const db = await getDb();
  const token = randomToken(32);
  await db.insert(sessions).values({ userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000), userAgent: userAgent?.slice(0, 200) });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: env.isProd, path: "/", maxAge: SESSION_DAYS * 86400 });
}

export async function destroySession() {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (raw) {
    const db = await getDb();
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(raw)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function findOrCreateUser(email: string, locale: string) {
  const db = await getDb();
  const e = email.trim().toLowerCase();
  const found = await db.select().from(users).where(eq(users.email, e)).limit(1);
  if (found[0]) {
    if (!found[0].emailVerifiedAt) await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, found[0].id));
    return found[0];
  }
  const [u] = await db.insert(users).values({ email: e, locale, emailVerifiedAt: new Date() }).returning();
  await audit({ actorUserId: u!.id, action: "user.created", targetType: "user", targetId: u!.id, meta: { via: "magic_link" } });
  return u!;
}

export async function createMagicLink(email: string, redirectTo: string | null) {
  const db = await getDb();
  const token = randomToken(32);
  const code = String(Math.floor(100000 + (crypto.getRandomValues(new Uint32Array(1))[0]! % 900000)));
  await db.insert(magicLinks).values({
    email: email.trim().toLowerCase(),
    tokenHash: sha256(token),
    codeHash: sha256(`${email.trim().toLowerCase()}:${code}`),
    redirectTo,
    expiresAt: new Date(Date.now() + 15 * 60000),
  });
  return { token, code };
}

export async function consumeMagicToken(token: string) {
  const db = await getDb();
  const [row] = await db
    .select()
    .from(magicLinks)
    .where(and(eq(magicLinks.tokenHash, sha256(token)), isNull(magicLinks.consumedAt), gt(magicLinks.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  await db.update(magicLinks).set({ consumedAt: new Date() }).where(eq(magicLinks.id, row.id));
  return row;
}

export async function consumeMagicCode(email: string, code: string) {
  const db = await getDb();
  const e = email.trim().toLowerCase();
  const [row] = await db
    .select()
    .from(magicLinks)
    .where(and(eq(magicLinks.email, e), isNull(magicLinks.consumedAt), gt(magicLinks.expiresAt, new Date())))
    .orderBy(desc(magicLinks.createdAt))
    .limit(1);
  if (!row || row.attempts >= 5) return null;
  if (row.codeHash !== sha256(`${e}:${code.trim()}`)) {
    await db.update(magicLinks).set({ attempts: row.attempts + 1 }).where(eq(magicLinks.id, row.id));
    return null;
  }
  await db.update(magicLinks).set({ consumedAt: new Date() }).where(eq(magicLinks.id, row.id));
  return row;
}
