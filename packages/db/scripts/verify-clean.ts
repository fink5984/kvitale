/**
 * Read-only check that a database holds no DEMO artefacts. Exit code 1 if anything is found.
 *   pnpm db:verify-clean
 */
import { sql } from "drizzle-orm";
import { createDb } from "../src/client";
import { describeDatabaseUrl, loadLocalEnv } from "../src/env-file";

loadLocalEnv();
console.log(`→ target: ${describeDatabaseUrl(process.env.DATABASE_URL)}`);
const h = await createDb();
const q = async <T = Record<string, unknown>>(text: string): Promise<T[]> => ((await h.db.execute(sql.raw(text))) as unknown as { rows: T[] }).rows;
const problems: string[] = [];

const cols = await q<{ table_name: string }>(`select table_name from information_schema.columns where table_schema='public' and column_name='is_demo'`);
for (const { table_name } of cols) {
  const n = Number((await q<{ n: string }>(`select count(*)::text n from "${table_name}" where is_demo`))[0]!.n);
  console.log(`  ${table_name}.is_demo = true : ${n}`);
  if (n) problems.push(`${n} demo row(s) in ${table_name}`);
}
const flag = await q<{ enabled: boolean }>(`select enabled from feature_flags where key='demo_mode'`);
console.log(`  feature flag demo_mode      : ${flag.length ? flag[0]!.enabled : "(absent)"}`);
if (flag[0]?.enabled) problems.push("feature flag demo_mode is ON");
const sim = Number((await q<{ n: string }>(`select count(*)::text n from devices where is_simulated`))[0]!.n);
console.log(`  simulated devices           : ${sim}`);
if (sim) problems.push(`${sim} simulated device(s)`);
const mail = Number((await q<{ n: string }>(`select count(*)::text n from outbound_emails where provider='devmailbox' or "to" like '%@demo.kvittel.local'`))[0]!.n);
console.log(`  dev-mailbox e-mails         : ${mail}`);
if (mail) problems.push(`${mail} dev-mailbox e-mail(s)`);
const dom = Number((await q<{ n: string }>(`select count(*)::text n from users where email like '%@demo.kvittel.local'`))[0]!.n);
console.log(`  @demo.kvittel.local users   : ${dom}`);
if (dom) problems.push(`${dom} demo-domain user(s)`);
const prov = await q<{ provider: string; n: string }>(`select provider, count(*)::text n from payments group by provider`);
console.log(`  payments by provider        : ${prov.length ? prov.map((p) => `${p.provider}=${p.n}`).join(", ") : "none"}`);
if (prov.some((p) => p.provider === "mock")) problems.push("mock payments present");
const cp = await q<{ code: string }>(`select code from coupons where code in ('WELCOME10','HILULA5')`);
if (cp.length) problems.push("seeded demo coupons present");
const summary = await q<{ t: string; n: string }>(`select 'graves' t, count(*)::text n from graves union all select 'orders', count(*)::text from orders union all select 'users', count(*)::text from users union all select 'devices', count(*)::text from devices`);
console.log(`  totals                      : ${summary.map((r) => `${r.t}=${r.n}`).join(", ")}`);
const gr = await q<{ slug: string; status: string }>(`select slug, status from graves order by sort_order`);
console.log(`  graves                      : ${gr.map((g) => `${g.slug}(${g.status})`).join(", ") || "none"}`);
await h.close();
if (problems.length) {
  console.error("✗ NOT CLEAN:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log("✓ clean: no demo data, demo_mode flag off.");
