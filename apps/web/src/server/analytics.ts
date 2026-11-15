import "server-only";
import { and, count, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { alerts, devices, graves, orderItems, orders, payments, printJobs } from "@kvittel/db";
import { getDb } from "./db";
import { ONLINE_WINDOW_MS } from "./devices";

const PAID_STATES = ["paid", "in_fulfillment", "fulfilled", "attention", "refunded", "partially_refunded"] as const;

interface Window {
  from: Date;
  to: Date;
}

async function windowStats(w: Window) {
  const db = await getDb();
  const ord = await db
    .select({ n: count(), demo: sql<number>`sum(case when ${orders.isDemo} then 1 else 0 end)` })
    .from(orders)
    .where(and(gte(orders.createdAt, w.from), lt(orders.createdAt, w.to), inArray(orders.status, [...PAID_STATES])));
  const items = await db
    .select({ status: orderItems.status, n: count() })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(gte(orders.createdAt, w.from), lt(orders.createdAt, w.to), inArray(orders.status, [...PAID_STATES])))
    .groupBy(orderItems.status);
  const rev = await db
    .select({ currency: payments.currency, gross: sql<number>`sum(${payments.amountMinor})`, refunded: sql<number>`sum(${payments.refundedMinor})`, fees: sql<number>`sum(coalesce(${payments.feeMinor},0))`, n: count() })
    .from(payments)
    .where(and(gte(payments.createdAt, w.from), lt(payments.createdAt, w.to), inArray(payments.status, ["succeeded", "refunded", "partially_refunded"])))
    .groupBy(payments.currency);
  const byStatus = Object.fromEntries(items.map((i) => [i.status, Number(i.n)]));
  const totalItems = items.reduce((s, i) => s + Number(i.n), 0);
  const problems = (byStatus.failed ?? 0) + (byStatus.uncertain ?? 0);
  const processed = (byStatus.delivered ?? 0) + problems;
  return {
    orders: Number(ord[0]?.n ?? 0),
    demoOrders: Number(ord[0]?.demo ?? 0),
    deliveries: totalItems,
    delivered: byStatus.delivered ?? 0,
    refundedItems: byStatus.refunded ?? 0,
    failureRate: processed ? (problems / processed) * 100 : 0,
    revenue: rev.map((r) => ({ currency: r.currency, gross: Number(r.gross), refunded: Number(r.refunded), fees: Number(r.fees), net: Number(r.gross) - Number(r.refunded) - Number(r.fees), count: Number(r.n) })).sort((a, b) => b.gross - a.gross),
  };
}

export async function overview(days: number) {
  const now = new Date();
  const cur = { from: new Date(now.getTime() - days * 86400000), to: now };
  const prev = { from: new Date(now.getTime() - 2 * days * 86400000), to: cur.from };
  const [a, b] = await Promise.all([windowStats(cur), windowStats(prev)]);
  const db = await getDb();

  // daily series (UTC days)
  const daily = await db
    .select({ day: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'YYYY-MM-DD')`, n: count() })
    .from(orders)
    .where(and(gte(orders.createdAt, cur.from), inArray(orders.status, [...PAID_STATES])))
    .groupBy(sql`1`);
  const deliveredDaily = await db
    .select({ day: sql<string>`to_char(date_trunc('day', ${orderItems.deliveredAt}), 'YYYY-MM-DD')`, n: count() })
    .from(orderItems)
    .where(and(gte(orderItems.deliveredAt, cur.from), eq(orderItems.status, "delivered")))
    .groupBy(sql`1`);
  const series: Array<{ x: string; y: number; y2: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    series.push({ x: d, y: Number(daily.find((r) => r.day === d)?.n ?? 0), y2: Number(deliveredDaily.find((r) => r.day === d)?.n ?? 0) });
  }

  const byLocale = await db.select({ k: orders.locale, n: count() }).from(orders).where(and(gte(orders.createdAt, cur.from), inArray(orders.status, [...PAID_STATES]))).groupBy(orders.locale);
  const byCountry = await db.select({ k: orders.countryHint, n: count() }).from(orders).where(and(gte(orders.createdAt, cur.from), inArray(orders.status, [...PAID_STATES]))).groupBy(orders.countryHint);
  const byGrave = await db
    .select({ k: graves.slug, n: count() })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(graves, eq(graves.id, orderItems.graveId))
    .where(and(gte(orders.createdAt, cur.from), inArray(orders.status, [...PAID_STATES])))
    .groupBy(graves.slug);

  const repeat = await db.execute(sql`select count(*) filter (where c > 1)::int as repeaters, count(*)::int as customers from (select email, count(*) c from orders where status in ('paid','in_fulfillment','fulfilled','attention','refunded','partially_refunded') group by email) t`);
  const rep = (repeat as unknown as { rows: Array<{ repeaters: number; customers: number }> }).rows?.[0] ?? { repeaters: 0, customers: 0 };

  const queued = await db.select({ n: count() }).from(printJobs).where(inArray(printJobs.status, ["queued", "scheduled", "leased", "printing"]));
  const uncertain = await db.select({ n: count() }).from(printJobs).where(eq(printJobs.status, "uncertain"));
  const devs = await db.select({ lastSeenAt: devices.lastSeenAt, status: devices.status }).from(devices).where(inArray(devices.status, ["active", "maintenance"]));
  const online = devs.filter((d) => d.lastSeenAt && now.getTime() - d.lastSeenAt.getTime() < ONLINE_WINDOW_MS).length;
  const openAlerts = await db.select({ kind: alerts.kind, severity: alerts.severity, n: count() }).from(alerts).where(ne(alerts.status, "resolved")).groupBy(alerts.kind, alerts.severity);
  const activeGraves = await db.select({ n: count() }).from(graves).where(eq(graves.status, "active"));

  return {
    days,
    cur: a,
    prev: b,
    series,
    byLocale: byLocale.map((r) => ({ k: r.k, n: Number(r.n) })).sort((x, y) => y.n - x.n),
    byCountry: byCountry.map((r) => ({ k: r.k ?? "—", n: Number(r.n) })).sort((x, y) => y.n - x.n),
    byGrave: byGrave.map((r) => ({ k: r.k, n: Number(r.n) })).sort((x, y) => y.n - x.n),
    repeatRate: rep.customers ? (Number(rep.repeaters) / Number(rep.customers)) * 100 : 0,
    queued: Number(queued[0]?.n ?? 0),
    uncertain: Number(uncertain[0]?.n ?? 0),
    devices: { online, total: devs.length },
    openAlerts: openAlerts.map((r) => ({ kind: r.kind, severity: r.severity, n: Number(r.n) })),
    paperLow: openAlerts.filter((r) => r.kind === "paper_low" || r.kind === "paper_end").reduce((s, r) => s + Number(r.n), 0),
    activeGraves: Number(activeGraves[0]?.n ?? 0),
  };
}
