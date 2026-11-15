import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { openSealed, repoRoot, seal } from "@kvittel/db";

/**
 * Object storage adapter. Every object is sealed (AES-256-GCM, key bound to its path)
 * by the app before it is stored, so the bucket never holds plaintext.
 * STORAGE_PROVIDER=local → .data/uploads (dev only); s3 → any S3-compatible bucket
 * (Cloudflare R2, AWS S3, ...). Objects are served only through our own routes.
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

const localStorageAdapter: Storage = {
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

function s3Adapter(): Storage {
  const need = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`STORAGE_PROVIDER=s3 requires ${k}`);
    return v;
  };
  const bucket = need("S3_BUCKET");
  let client: Promise<import("@aws-sdk/client-s3").S3Client> | undefined;
  const get = () =>
    (client ??= import("@aws-sdk/client-s3").then(
      ({ S3Client }) =>
        new S3Client({
          region: process.env.S3_REGION || "auto",
          endpoint: need("S3_ENDPOINT"),
          credentials: { accessKeyId: need("S3_ACCESS_KEY_ID"), secretAccessKey: need("S3_SECRET_ACCESS_KEY") },
          forcePathStyle: true,
          maxAttempts: 2,
          requestHandler: { requestTimeout: 20_000, connectionTimeout: 5_000 },
        }),
    ));
  const check = (key: string) => {
    if (!/^[a-z0-9/_-]+$/i.test(key) || key.includes("..")) throw new Error("bad storage key");
    return key;
  };
  return {
    async put(key, data) {
      const { PutObjectCommand } = await import("@aws-sdk/client-s3");
      await (await get()).send(new PutObjectCommand({ Bucket: bucket, Key: check(key), Body: seal(data, `file:${key}`), ContentType: "application/octet-stream" }));
    },
    async get(key) {
      const { GetObjectCommand } = await import("@aws-sdk/client-s3");
      try {
        const r = await (await get()).send(new GetObjectCommand({ Bucket: bucket, Key: check(key) }));
        const env = await r.Body!.transformToString("utf8");
        return openSealed(env, `file:${key}`);
      } catch (e) {
        if ((e as { name?: string }).name === "NoSuchKey") return null;
        throw e;
      }
    },
    async remove(key) {
      const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
      await (await get()).send(new DeleteObjectCommand({ Bucket: bucket, Key: check(key) }));
    },
  };
}

let cached: Storage | undefined;
const pick = (): Storage => (cached ??= process.env.STORAGE_PROVIDER === "s3" ? s3Adapter() : localStorageAdapter);
export const storage: Storage = {
  put: (k, d) => pick().put(k, d),
  get: (k) => pick().get(k),
  remove: (k) => pick().remove(k),
};
