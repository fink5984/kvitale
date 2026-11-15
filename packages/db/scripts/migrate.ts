import { createDb } from "../src/client";
import { describeDatabaseUrl, loadLocalEnv } from "../src/env-file";

loadLocalEnv();
console.log(`→ target: ${describeDatabaseUrl(process.env.DATABASE_URL)}`);
const h = await createDb();
await h.migrate();
console.log(`✓ migrations applied (${h.driver})`);
await h.close();
