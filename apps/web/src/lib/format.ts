import { INTL_TAG, type AppLocale } from "@/i18n/locales";
import { hebrewDateString } from "./hebrew-date";

const tag = (l: string) => INTL_TAG[l as AppLocale] ?? l;

export function formatMoney(minor: number, currency: string, locale: string) {
  return new Intl.NumberFormat(tag(locale), { style: "currency", currency, minimumFractionDigits: minor % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(minor / 100);
}

export function formatDateTime(iso: string | Date, locale: string, timeZone?: string, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }) {
  return new Intl.DateTimeFormat(tag(locale), { ...opts, timeZone }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatDate(iso: string | Date, locale: string, timeZone?: string) {
  return formatDateTime(iso, locale, timeZone, { dateStyle: "long" });
}

export function formatNumber(n: number, locale: string, opts?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat(tag(locale), opts).format(n);
}

export function hebrewDate(iso: string | Date, locale: string) {
  try {
    // Hebrew / Yiddish pages: the full date in Hebrew letters (ו׳ כסלו תשפ״ז), the same function the printer uses
    if (locale === "he" || locale === "yi") return hebrewDateString(typeof iso === "string" ? new Date(iso) : iso, locale);
    return new Intl.DateTimeFormat(`${tag(locale)}-u-ca-hebrew`, { day: "numeric", month: "long", year: "numeric" }).format(typeof iso === "string" ? new Date(iso) : iso);
  } catch {
    return "";
  }
}

export function countryName(code: string, locale: string) {
  try {
    return new Intl.DisplayNames([tag(locale)], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function relativeTime(iso: string | Date, locale: string, now = Date.now()) {
  const d = (typeof iso === "string" ? new Date(iso) : iso).getTime() - now;
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" });
  const abs = Math.abs(d);
  if (abs < 60_000) return rtf.format(Math.round(d / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(d / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(d / 3_600_000), "hour");
  return rtf.format(Math.round(d / 86_400_000), "day");
}

export function cn(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(" ");
}
