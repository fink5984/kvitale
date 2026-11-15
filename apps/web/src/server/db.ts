import "server-only";
import { createDb, type DB, type DbHandle } from "@kvittel/db";

const g = globalThis as unknown as { __kvDb?: Promise<DbHandle> };

/**
 * One DB handle per server process (PGlite is single-process; HMR must not
 * open a second instance). Migrations run on first use so a fresh checkout works.
 */
export function dbHandle(): Promise<DbHandle> {
  g.__kvDb ??= (async () => {
    const h = await createDb();
    if (process.env.KVITTEL_AUTO_MIGRATE !== "0") await h.migrate();
    return h;
  })();
  return g.__kvDb;
}

export async function getDb(): Promise<DB> {
  return (await dbHandle()).db;
}
