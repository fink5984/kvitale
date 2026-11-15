import { readdirSync } from "node:fs";
import path from "node:path";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

/**
 * Every *.json in messages/<locale>/ is deep-merged, so feature modules can own
 * their catalog file (e.g. admin-devices.json → { "admin": { "devices": … } }).
 */
function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object") deepMerge(a[k] as Record<string, unknown>, v as Record<string, unknown>);
    else a[k] = v;
  }
  return a;
}

const cache = new Map<string, Record<string, unknown>>();

export async function loadMessages(locale: string) {
  if (process.env.NODE_ENV === "production" && cache.has(locale)) return structuredClone(cache.get(locale)!);
  const dir = path.join(process.cwd(), "messages", locale);
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const out: Record<string, unknown> = {};
  for (const f of files) {
    const mod = (await import(`../../messages/${locale}/${f.replace(/\.json$/, "")}.json`)) as { default: Record<string, unknown> };
    deepMerge(out, structuredClone(mod.default));
  }
  cache.set(locale, out);
  return structuredClone(out);
}

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale,
    messages: await loadMessages(locale),
    timeZone: "UTC",
    onError(error) {
      if (process.env.NODE_ENV !== "production") console.error(error.message);
    },
    getMessageFallback({ namespace, key }) {
      return `⟨${[namespace, key].filter(Boolean).join(".")}⟩`;
    },
  };
});
