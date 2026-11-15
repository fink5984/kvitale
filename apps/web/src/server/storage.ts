import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { openSealed, repoRoot, seal } from "@kvittel/db";

/**
 * Object storage adapter. Local encrypted files for development; swap for an
 * S3-compatible bucket with server-side encryption + signed URLs in production.
 */
export interface Storage {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  remove(key: string): Promise<void>;
}

const base = () => path.join(repoRoot(), ".data", "uploads");
const safe = (key: string) => {
  if (!/^[a-z0-9/_-]+$/i.test(key) || key.includes("..")) throw new Error("bad storage key");
  return path.join(base(), key);
};

export const storage: Storage = {
  async put(key, data) {
    const p = safe(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, seal(data, `file:${key}`));
  },
  async get(key) {
    try {
      const env = await readFile(safe(key), "utf8");
      return openSealed(env, `file:${key}`);
    } catch {
      return null;
    }
  },
  async remove(key) {
    await unlink(safe(key)).catch(() => {});
  },
};
