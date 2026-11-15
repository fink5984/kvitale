/**
 * Sanitised logger. Strips known-sensitive keys so kvittel content, tokens and
 * emails never reach stdout / log drains / error monitoring.
 */
const SENSITIVE = /^(content|request|people|names?|given|parent|freeText|signature|graveDisplayName|token|password|code|email|contentEnc|data|raster)$/i;

function redact(v: unknown, depth = 0): unknown {
  if (depth > 4 || v === null || typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map((x) => redact(x, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = SENSITIVE.test(k) ? "[redacted]" : redact(val, depth + 1);
  return out;
}

export const log = {
  info: (msg: string, meta?: Record<string, unknown>) => console.info(JSON.stringify({ level: "info", msg, ...(redact(meta) as object) })),
  warn: (msg: string, meta?: Record<string, unknown>) => console.warn(JSON.stringify({ level: "warn", msg, ...(redact(meta) as object) })),
  error: (msg: string, meta?: Record<string, unknown>) => console.error(JSON.stringify({ level: "error", msg, ...(redact(meta) as object) })),
  redact,
};
