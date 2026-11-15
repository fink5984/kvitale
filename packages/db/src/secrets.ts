import { scryptSync, timingSafeEqual, createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./client";

type SecretName = "KVITTEL_ENCRYPTION_KEY" | "SESSION_SECRET" | "PAYMENT_WEBHOOK_SECRET" | "DEVICE_COMMAND_SECRET" | "TRACKING_TOKEN_SECRET";

/**
 * Secrets come from env. In development only, missing secrets are generated once
 * into .data/dev-secrets.json (git-ignored) so web, seed and simulator agree.
 * In production a missing secret is a hard error.
 */
export function secret(name: SecretName): string {
  const v = process.env[name];
  if (v) return v;
  if (process.env.NODE_ENV === "production" && process.env.KVITTEL_ALLOW_DEV_SECRETS !== "1")
    throw new Error(`Missing required secret ${name}`);
  const file = path.join(repoRoot(), ".data", "dev-secrets.json");
  let data: Record<string, string> = {};
  if (existsSync(file)) data = JSON.parse(readFileSync(file, "utf8"));
  if (!data[name]) {
    data[name] = randomBytes(32).toString("base64");
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data, null, 2));
  }
  return data[name]!;
}

function key(): Buffer {
  const k = Buffer.from(secret("KVITTEL_ENCRYPTION_KEY"), "base64");
  if (k.length !== 32) throw new Error("KVITTEL_ENCRYPTION_KEY must be 32 bytes, base64-encoded");
  return k;
}

/** AES-256-GCM envelope: "v1.<iv>.<tag>.<ciphertext>" (base64url parts). */
export function seal(plaintext: string | Buffer, aad = "kvittel"): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  c.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([c.update(plaintext), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function openSealed(envelope: string, aad = "kvittel"): Buffer {
  const [v, iv, tag, ct] = envelope.split(".");
  if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("Bad envelope");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64url")), d.final()]);
}

export function sha256(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Password hashing: scrypt (N=2^15, r=8, p=1), random 16-byte salt. Format: scrypt$N$r$p$salt$hash (base64url). */
const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const dk = scryptSync(password, salt, 32, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64url"), dk.toString("base64url")].join("$");
}
export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  // Always do the same work, so a missing account is not distinguishable by timing.
  const [alg, N, r, p, salt, hash] = (stored ?? "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA").split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const dk = scryptSync(password, Buffer.from(salt, "base64url"), expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return !!stored && dk.length === expected.length && timingSafeEqual(dk, expected);
}
