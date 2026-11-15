import { rmSync } from "node:fs";
import { pgliteDir } from "../src/client";
import { loadLocalEnv } from "../src/env-file";

loadLocalEnv();
if (process.env.DATABASE_URL) {
  console.error("Refusing to reset a DATABASE_URL database. Drop it manually if you really mean it.");
  process.exit(1);
}
rmSync(pgliteDir(), { recursive: true, force: true });
console.log("✓ local PGlite data removed:", pgliteDir());
