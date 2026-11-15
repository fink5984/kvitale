/**
 * Creates the first real super admin — securely, without any shared password or open demo account.
 *
 *   pnpm admin:bootstrap you@example.com --yes
 *
 * The user is created (or reused) as a NON-demo user with the super_admin role, and a one-time
 * sign-in link (15 minutes, single use) is printed to THIS terminal only. Sessions then work through the
 * normal e-mail magic-link flow, or with the password set below (staff password sign-in).
 * A strong random password is generated and printed ONCE (or taken from ADMIN_PASSWORD, min 12 chars).
 * Re-running resets the password and unlocks the account. Refuses demo addresses. Run it only from a machine you trust.
 */
import { and, eq, isNull } from "drizzle-orm";
import { createDb } from "../src/client";
import { describeDatabaseUrl, loadLocalEnv } from "../src/env-file";
import * as s from "../src/schema";
import { hashPassword, randomToken, sha256 } from "../src/secrets";

loadLocalEnv();
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.endsWith("@demo.kvittel.local")) {
  console.error("Usage: pnpm admin:bootstrap you@example.com --yes");
  process.exit(1);
}
console.log(`→ target: ${describeDatabaseUrl(process.env.DATABASE_URL)}`);
if (!process.argv.includes("--yes")) {
  console.error(`Would make ${email} a super admin on the target above. Re-run with --yes to proceed.`);
  process.exit(1);
}
const h = await createDb();
const db = h.db;
let [u] = await db.select().from(s.users).where(eq(s.users.email, email)).limit(1);
if (!u) [u] = await db.insert(s.users).values({ email, locale: "he", currency: "ILS", emailVerifiedAt: new Date(), isDemo: false }).returning();
else if (u.isDemo) {
  console.error("That account is flagged demo. Use a different address.");
  process.exit(1);
}
const has = await db.select().from(s.roleAssignments).where(and(eq(s.roleAssignments.userId, u!.id), eq(s.roleAssignments.role, "super_admin"), isNull(s.roleAssignments.revokedAt)));
if (!has.length) await db.insert(s.roleAssignments).values({ userId: u!.id, role: "super_admin" });
await db.insert(s.auditLogs).values({ actorKind: "system", action: "admin.bootstrap", targetType: "user", targetId: u!.id, meta: {} });
const password = process.env.ADMIN_PASSWORD || randomToken(15);
if (password.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters.");
  process.exit(1);
}
await db.update(s.users).set({ passwordHash: hashPassword(password), passwordFailures: 0, passwordLockedUntil: null }).where(eq(s.users.id, u!.id));
const token = randomToken(32);
await db.insert(s.magicLinks).values({ email, tokenHash: sha256(token), codeHash: sha256(`${email}:000000-unused`), redirectTo: "/admin", expiresAt: new Date(Date.now() + 15 * 60000) });
const app = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
console.log(`\n✓ ${email} is a super admin.\nPassword: ${process.env.ADMIN_PASSWORD ? "(taken from ADMIN_PASSWORD)" : password + "   <- shown once, store it in a password manager"}\n\nOne-time sign-in link (valid 15 minutes, single use):\n\n  ${app}/he/login/verify?token=${token}\n`);
await h.close();
