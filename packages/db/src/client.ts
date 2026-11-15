import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

/** Walk up from cwd to the monorepo root (where pnpm-workspace.yaml lives). */
export function repoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return process.cwd();
}

export function migrationsFolder(): string {
  return process.env.KVITTEL_MIGRATIONS_DIR || path.join(repoRoot(), "packages", "db", "drizzle");
}

export function pgliteDir(): string {
  return process.env.PGLITE_DIR || path.join(repoRoot(), ".data", "pglite");
}

export interface DbHandle {
  db: DB;
  driver: "pglite" | "postgres";
  close(): Promise<void>;
  migrate(): Promise<void>;
}

/**
 * DATABASE_URL set → node-postgres (production / real server).
 * Otherwise → PGlite: a real PostgreSQL engine embedded in-process, persisted to
 * .data/pglite. No Docker or local server required. Single-process only.
 */
export async function createDb(): Promise<DbHandle> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const makePool = (connectionString: string, max: number) => {
      const pool = new Pool({
        connectionString,
        max,
        // Serverless Postgres (Neon) suspends idle computes and closes their sockets.
        // Recycle idle clients before that happens and allow for a cold start on connect.
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 15_000,
        keepAlive: true,
      });
      // An idle client dropped by the server emits 'error' on the pool; without a
      // listener Node treats it as an uncaught exception and kills the process.
      pool.on("error", (err) => console.error("[db] idle client error:", err.message));
      return pool;
    };
    const pool = makePool(url, Number(process.env.DB_POOL_MAX ?? 10));
    const db = drizzle(pool, { schema }) as unknown as DB;
    return {
      db,
      driver: "postgres",
      close: () => pool.end(),
      // Migrations use the direct (non-pooled) endpoint when one is provided —
      // e.g. Neon's DATABASE_URL_UNPOOLED — since DDL is safest outside PgBouncer.
      migrate: async () => {
        const direct = process.env.DATABASE_URL_UNPOOLED || process.env.DIRECT_DATABASE_URL;
        if (!direct) return migrate(db as never, { migrationsFolder: migrationsFolder() });
        const mpool = makePool(direct, 1);
        try {
          await migrate(drizzle(mpool, { schema }) as never, { migrationsFolder: migrationsFolder() });
        } finally {
          await mpool.end();
        }
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = pgliteDir();
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await client.waitReady;
  const db = drizzle(client, { schema }) as unknown as DB;
  return {
    db,
    driver: "pglite",
    close: () => client.close(),
    migrate: () => migrate(db as never, { migrationsFolder: migrationsFolder() }),
  };
}
