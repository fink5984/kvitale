import "server-only";
import { cookies } from "next/headers";
import { CURRENCIES, DEFAULT_CURRENCY, type Currency } from "@/i18n/locales";

export async function getCurrency(locale: string): Promise<Currency> {
  const c = (await cookies()).get("kv_currency")?.value;
  if (c && (CURRENCIES as readonly string[]).includes(c)) return c as Currency;
  return DEFAULT_CURRENCY[locale] ?? "USD";
}
