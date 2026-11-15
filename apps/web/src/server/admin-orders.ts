import "server-only";
import { and, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { auditLogs, graves, graveTranslations, orderItems, orders, paymentEvents, payments, printAttempts, printJobs, refunds } from "@kvittel/db";
import { getDb } from "./db";

export const PAGE_SIZE = 25;

export interface OrderFilter {
  q?: string;
  status?: string;
  grave?: string;
  from?: string;
  to?: string;
  page?: number;
}

export async function listOrders(f: OrderFilter) {
  const db = await getDb();
  const conds: SQL[] = [];
  if (f.q?.trim()) {
    const q = `%${f.q.trim().replace(/[%_]/g, "")}%`;
    conds.push(or(ilike(orders.publicRef, q), ilike(orders.email, q))!);
  }
  if (f.status === "delivered") conds.push(eq(orders.status, "fulfilled"));
  else if (f.status && f.status !== "all") conds.push(eq(orders.status, f.status as never));
  if (f.from) conds.push(gte(orders.createdAt, new Date(f.from)));
  if (f.to) conds.push(lte(orders.createdAt, new Date(`${f.to}T23:59:59Z`)));
  if (f.grave) {
    const sub = db.select({ id: orderItems.orderId }).from(orderItems).innerJoin(graves, eq(graves.id, orderItems.graveId)).where(eq(graves.slug, f.grave));
    conds.push(inArray(orders.id, sub));
  }
  const where = conds.length ? and(...conds) : undefined;
  const page = Math.max(1, f.page ?? 1);
  const [{ n }] = (await db.select({ n: count() }).from(orders).where(where)) as [{ n: number }];
  const rows = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE);
  const items = rows.length ? await db.select({ orderId: orderItems.orderId, slug: graves.slug, status: orderItems.status }).from(orderItems).innerJoin(graves, eq(graves.id, orderItems.graveId)).where(inArray(orderItems.orderId, rows.map((r) => r.id))) : [];
  return {
    total: Number(n),
    page,
    pages: Math.max(1, Math.ceil(Number(n) / PAGE_SIZE)),
    rows: rows.map((r) => ({ ...r, items: items.filter((i) => i.orderId === r.id) })),
  };
}

export async function orderDetail(ref: string, locale: string) {
  const db = await getDb();
  const [o] = await db.select().from(orders).where(eq(orders.publicRef, ref));
  if (!o) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, o.id));
  const jobs = items.length ? await db.select().from(printJobs).where(inArray(printJobs.orderItemId, items.map((i) => i.id))) : [];
  const attempts = jobs.length ? await db.select().from(printAttempts).where(inArray(printAttempts.jobId, jobs.map((j) => j.id))).orderBy(printAttempts.attemptNo) : [];
  const pays = await db.select().from(payments).where(eq(payments.orderId, o.id));
  const events = pays.length ? await db.select().from(paymentEvents).where(inArray(paymentEvents.paymentId, pays.map((p) => p.id))).orderBy(desc(paymentEvents.receivedAt)) : [];
  const refs = pays.length ? await db.select().from(refunds).where(inArray(refunds.paymentId, pays.map((p) => p.id))).orderBy(desc(refunds.createdAt)) : [];
  const names = await db.select().from(graveTranslations).where(inArray(graveTranslations.graveId, items.map((i) => i.graveId)));
  const audit = await db
    .select()
    .from(auditLogs)
    .where(or(and(eq(auditLogs.targetType, "order"), eq(auditLogs.targetId, o.id)), and(eq(auditLogs.targetType, "print_job"), inArray(auditLogs.targetId, jobs.length ? jobs.map((j) => j.id) : ["-"]))))
    .orderBy(desc(auditLogs.createdAt))
    .limit(50);
  const gs = await db.select().from(graves).where(inArray(graves.id, items.map((i) => i.graveId)));
  return {
    order: o,
    items: items.map((it) => ({
      ...it,
      graveName: (names.find((n) => n.graveId === it.graveId && n.locale === locale) ?? names.find((n) => n.graveId === it.graveId))?.name ?? "",
      timezone: gs.find((g) => g.id === it.graveId)?.timezone ?? "UTC",
      job: jobs.find((j) => j.orderItemId === it.id) ?? null,
      attempts: attempts.filter((a) => a.jobId === jobs.find((j) => j.orderItemId === it.id)?.id),
    })),
    payments: pays,
    paymentEvents: events,
    refunds: refs,
    audit,
  };
}

export async function orderStatusCounts() {
  const db = await getDb();
  const rows = await db.select({ s: orders.status, n: count() }).from(orders).groupBy(orders.status);
  return Object.fromEntries(rows.map((r) => [r.s, Number(r.n)]));
}

export async function customersList(q?: string, page = 1) {
  const db = await getDb();
  const like = q?.trim() ? sql`where email ilike ${`%${q.trim().replace(/[%_]/g, "")}%`}` : sql``;
  const res = await db.execute(sql`
    select email,
      count(*)::int as orders,
      max(created_at) as last_order,
      bool_or(user_id is not null) as registered,
      bool_or(marketing_consent) as marketing,
      bool_or(is_demo) as demo
    from orders ${like}
    group by email
    order by max(created_at) desc
    limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`);
  return (res as unknown as { rows: Array<{ email: string; orders: number; last_order: string; registered: boolean; marketing: boolean; demo: boolean }> }).rows;
}
