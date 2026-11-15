/**
 * Controlled removal of DEMO data. Never a blind delete.
 *
 *   pnpm db:purge-demo                       # DRY RUN: prints exactly what would be removed
 *   pnpm db:purge-demo --confirm=<db-host>   # backs up every table to JSON, then deletes in ONE transaction
 *
 * What is removed: rows flagged is_demo (graves, orders, users, partners, payments), everything that
 * depends on them (found from the real foreign keys, not a hand-written list), the seeded demo coupons,
 * dev-mailbox e-mails and the "seed.demo" audit row. Rows NOT flagged demo are never selected as roots.
 * Aborts if a non-demo order references a demo grave (needs a human decision).
 * Configuration (prices, flags, settings, legal pages, printer profiles) is kept.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { createDb, repoRoot } from "../src/client";
import { describeDatabaseUrl, loadLocalEnv } from "../src/env-file";

loadLocalEnv();
const url = process.env.DATABASE_URL;
const host = url ? new URL(url).hostname : "pglite";
console.log(`→ target: ${describeDatabaseUrl(url)}`);
const confirm = process.argv.find((a) => a.startsWith("--confirm="))?.split("=")[1];
const apply = !!confirm;
if (apply && confirm !== host) {
  console.error(`--confirm must equal the database host (${host}).`);
  process.exit(1);
}
const h = await createDb(); // NOTE: deliberately no migrate() — this script never changes schema
const db = h.db;
const q = async <T = Record<string, unknown>>(text: string): Promise<T[]> => ((await db.execute(sql.raw(text))) as unknown as { rows: T[] }).rows;

const tables = (await q<{ table_name: string }>(`select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' and table_name not like '\\_\\_%' and table_name not like 'drizzle%'`)).map((r) => r.table_name);
const fks = await q<{ child: string; col: string; parent: string; pcol: string }>(`
  select kcu.table_name as child, kcu.column_name as col, ccu.table_name as parent, ccu.column_name as pcol
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
  join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
  where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`);

/** Safety: a real (non-demo) order must never hang off a demo grave. */
const mixed = await q<{ n: string }>(`select count(*)::text n from order_items oi join orders o on o.id=oi.order_id join graves g on g.id=oi.grave_id where g.is_demo and not o.is_demo`);
if (Number(mixed[0]?.n) > 0) {
  console.error(`ABORT: ${mixed[0]!.n} non-demo order item(s) reference demo graves. Resolve manually first.`);
  process.exit(2);
}

type Root = { table: string; where: string; label: string };
const roots: Root[] = [
  { table: "orders", where: "is_demo", label: "demo orders" },
  { table: "devices", where: "id in (select da.device_id from device_assignments da join graves g on g.id=da.grave_id where g.is_demo)", label: "simulated devices of demo graves" },
  { table: "graves", where: "is_demo", label: "demo graves" },
  { table: "partners", where: "is_demo", label: "demo partners" },
  { table: "users", where: "is_demo", label: "demo users" },
  { table: "coupons", where: "code in ('WELCOME10','HILULA5')", label: "seeded demo coupons" },
  { table: "outbound_emails", where: "provider = 'devmailbox' or \"to\" like '%@demo.kvittel.local'", label: "dev-mailbox e-mails" },
  { table: "audit_logs", where: "action = 'seed.demo'", label: "demo seed marker" },
];

// Resolve every root to explicit ids BEFORE anything is deleted (conditions may depend on rows removed earlier).
for (const r of roots) {
  if (!tables.includes(r.table)) continue;
  const ids = (await q<{ id: string }>(`select id from ${r.table} where ${r.where}`)).map((x) => x.id);
  r.where = ids.length ? `id in (${ids.map((i) => `'${i}'`).join(",")})` : "false";
}

/** Collects the ids to delete per table by walking foreign keys downward (children first on delete). */
async function plan() {
  const plan: Array<{ table: string; where: string }> = [];
  const seen = new Set<string>();
  const walk = async (table: string, where: string) => {
    const key = `${table}|${where}`;
    if (seen.has(key)) return;
    seen.add(key);
    for (const fk of fks.filter((f) => f.parent === table)) {
      if (fk.child === table) continue;
      await walk(fk.child, `${fk.col} in (select ${fk.pcol} from ${table} where ${where})`);
    }
    plan.push({ table, where });
  };
  for (const r of roots) if (tables.includes(r.table)) await walk(r.table, r.where);
  return plan;
}

const steps = await plan();
console.log("\nWould remove:");
for (const r of roots) {
  if (!tables.includes(r.table)) continue;
  const n = (await q<{ n: string }>(`select count(*)::text n from ${r.table} where ${r.where}`))[0]!.n;
  console.log(`  ${r.label.padEnd(34)} ${n}`);
}
const remaining = async () => {
  for (const t of ["graves", "orders", "users", "devices"]) console.log(`  ${t.padEnd(10)} ${(await q<{ n: string }>(`select count(*)::text n from ${t}`))[0]!.n}`);
};
console.log("\nCurrently in the database:");
await remaining();

if (!apply) {
  console.log(`\nDRY RUN only. Re-run with --confirm=${host} to back up and delete.`);
  await h.close();
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = path.join(repoRoot(), ".data", "backups", `demo-purge-${stamp}`);
mkdirSync(dir, { recursive: true });
for (const t of tables) writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(await q(`select * from "${t}"`)));
console.log(`\n✓ backup of ${tables.length} tables → ${dir}`);

await db.transaction(async (tx) => {
  for (const st of steps) {
    const r = (await tx.execute(sql.raw(`delete from "${st.table}" where ${st.where}`))) as unknown as { rowCount?: number; affectedRows?: number };
    const n = r.rowCount ?? r.affectedRows ?? 0;
    if (n) console.log(`  deleted ${String(n).padStart(6)}  ${st.table}`);
  }
  await tx.execute(sql.raw(`update feature_flags set enabled=false where key='demo_mode'`));
});
console.log("\n✓ demo data removed. Now in the database:");
await remaining();
await h.close();
