import "server-only";

/**
 * In-process sliding-window limiter. Adequate for a single instance; swap for a
 * shared store (Redis / Postgres) when horizontally scaling — interface stays.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterMs: number } {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    buckets.set(key, arr);
    return { ok: false, retryAfterMs: windowMs - (now - arr[0]!) };
  }
  arr.push(now);
  buckets.set(key, arr);
  if (buckets.size > 50_000) buckets.clear();
  return { ok: true, retryAfterMs: 0 };
}
