import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./auth/session";
import type { Permission } from "./rbac";

/** Page-level guard. Server actions must call requirePermission() themselves as well. */
export async function guardPage(locale: string, perm: Permission, nextPath: string): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect(`/${locale}/login?next=${encodeURIComponent(nextPath)}`);
  if (!s.permissions.has(perm)) redirect(`/${locale}/admin/forbidden`);
  return s;
}

export function serializeSession(s: SessionUser) {
  return { email: s.email, displayName: s.displayName, roles: s.roles, permissions: [...s.permissions], scoped: s.graveScope !== null, isDemo: s.isDemo };
}
export type ClientSession = ReturnType<typeof serializeSession>;
