/**
 * Role-based access control. Checked server-side on every action; the UI only
 * hides what the server would refuse anyway.
 */
export const ROLES = ["super_admin", "admin", "finance", "support_limited", "content_editor", "partner_manager", "local_maintainer", "customer"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "admin.access",
  "overview.read",
  "graves.read",
  "graves.write",
  "graves.publish",
  "orders.read",
  "orders.manage",
  "orders.refund.request",
  "orders.refund.approve",
  "kvittel.content.read",
  "customers.read",
  "customers.manage",
  "pricing.read",
  "pricing.write",
  "finance.read",
  "devices.read",
  "devices.command",
  "devices.provision",
  "maintenance.manage",
  "partners.manage",
  "content.write",
  "settings.write",
  "flags.write",
  "roles.write",
  "audit.read",
  "lab.use",
  "operator.access",
  "operator.test_print",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ALL = [...PERMISSIONS] as Permission[];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Even super_admin reads kvittel content only with a recorded reason (see audit).
  super_admin: ALL,
  admin: ALL.filter((p) => p !== "kvittel.content.read" && p !== "roles.write"),
  finance: ["admin.access", "overview.read", "orders.read", "orders.refund.approve", "pricing.read", "finance.read", "customers.read", "audit.read"],
  support_limited: ["admin.access", "overview.read", "orders.read", "orders.manage", "orders.refund.request", "customers.read", "graves.read", "devices.read"],
  content_editor: ["admin.access", "graves.read", "graves.write", "content.write", "pricing.read"],
  partner_manager: ["operator.access", "operator.test_print", "maintenance.manage", "devices.read"],
  local_maintainer: ["operator.access", "operator.test_print", "maintenance.manage"],
  customer: [],
};

/** Roles whose access is limited to the graves of their partner. */
export const SCOPED_ROLES: Role[] = ["partner_manager", "local_maintainer"];

export function permissionsFor(roles: Role[]): Set<Permission> {
  const s = new Set<Permission>();
  for (const r of roles) for (const p of ROLE_PERMISSIONS[r] ?? []) s.add(p);
  return s;
}
