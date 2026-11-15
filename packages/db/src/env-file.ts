import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { repoRoot } from "./client";

/**
 * CLI scripts (migrate / seed / reset) run outside Next.js, which is what normally
 * loads apps/web/.env.local. Load the same files here so `pnpm setup` targets the
 * same database as the web app. Variables already set in the shell always win.
 */
export function loadLocalEnv(): string[] {
  const root = repoRoot();
  const loaded: string[] = [];
  for (const rel of ["apps/web/.env.local", ".env.local", "apps/web/.env", ".env"]) {
    const file = path.join(root, rel);
    if (!existsSync(file)) continue;
    const vars = parseEnv(readFileSync(file, "utf8"));
    for (const [k, v] of Object.entries(vars)) if (process.env[k] === undefined && v !== undefined) process.env[k] = v;
    loaded.push(rel);
  }
  return loaded;
}

/** "user@host/db" with the password removed — safe for console output, never for logs with content. */
export function describeDatabaseUrl(url: string | undefined): string {
  if (!url) return "PGlite (embedded, .data/pglite)";
  try {
    const u = new URL(url);
    return `PostgreSQL ${u.username}@${u.hostname}${u.pathname}`;
  } catch {
    return "PostgreSQL (unparseable DATABASE_URL)";
  }
}
