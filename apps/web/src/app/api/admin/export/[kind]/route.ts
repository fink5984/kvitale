import { and, desc, gte, inArray, lte } from "drizzle-orm";
import { orders, payments } from "@kvittel/db";
import { AuthError, requirePermission } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { listOrders } from "@/server/admin-orders";
import { getDb } from "@/server/db";

const csv = (rows: Array<Array<string | number | null | undefined>>) =>
  rows.map((r) => r.map((v) => { const s = String(v ?? ""); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; }).join(",")).join("\n");

/** CSV exports never include kvittel content. Formula-injection safe. */
export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const url = new URL(req.url);
  try {
    if (kind === "orders") {
      const u = await requirePermission("orders.read");
      const all: Array<Array<string | number | null>> = [["ref", "created_at", "email", "status", "currency", "subtotal_minor", "discount_minor", "total_minor", "locale", "deliveries", "is_demo"]];
      let page = 1;
      for (;;) {
        const r = await listOrders({ q: url.searchParams.get("q") ?? undefined, status: url.searchParams.get("status") ?? undefined, grave: url.searchParams.get("grave") ?? undefined, from: url.searchParams.get("from") ?? undefined, to: url.searchParams.get("to") ?? undefined, page });
        for (const o of r.rows) all.push([o.publicRef, o.createdAt.toISOString(), o.email, o.status, o.currency, o.subtotalMinor, o.discountMinor, o.totalMinor, o.locale, o.items.length, o.isDemo ? 1 : 0]);
        if (page >= r.pages || page > 400) break;
        page++;
      }
      await audit({ actorUserId: u.id, action: "export.orders", meta: { rows: all.length - 1 } });
      return new Response(csv(all), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=orders.csv", "cache-control": "no-store" } });
    }
    if (kind === "finance") {
      const u = await requirePermission("finance.read");
      const db = await getDb();
      const from = url.searchParams.get("from") ? new Date(url.searchParams.get("from")!) : new Date(Date.now() - 90 * 86400000);
      const to = url.searchParams.get("to") ? new Date(`${url.searchParams.get("to")}T23:59:59Z`) : new Date();
      const rows = await db.select({ p: payments, ref: orders.publicRef }).from(payments).innerJoin(orders, (await import("drizzle-orm")).eq(orders.id, payments.orderId)).where(and(gte(payments.createdAt, from), lte(payments.createdAt, to), inArray(payments.status, ["succeeded", "refunded", "partially_refunded"]))).orderBy(desc(payments.createdAt));
      const out: Array<Array<string | number | null>> = [["date", "order_ref", "provider", "provider_ref", "currency", "gross_minor", "fee_minor", "refunded_minor", "net_minor", "is_demo"]];
      for (const r of rows) out.push([r.p.createdAt.toISOString(), r.ref, r.p.provider, r.p.providerRef, r.p.currency, r.p.amountMinor, r.p.feeMinor ?? 0, r.p.refundedMinor, r.p.amountMinor - r.p.refundedMinor - (r.p.feeMinor ?? 0), r.p.isDemo ? 1 : 0]);
      await audit({ actorUserId: u.id, action: "export.finance", meta: { rows: out.length - 1 } });
      return new Response(csv(out), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=finance.csv", "cache-control": "no-store" } });
    }
    return new Response("not found", { status: 404 });
  } catch (e) {
    if (e instanceof AuthError) return new Response(e.code, { status: e.code === "unauthenticated" ? 401 : 403 });
    throw e;
  }
}
