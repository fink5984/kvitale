export const CORE_LOCALES = ["he", "en", "fr", "ru"] as const;
/** Infrastructure + catalogs exist; enabled only after native QA via NEXT_PUBLIC_EXTRA_LOCALES. */
export const EXTRA_LOCALES = ["yi", "es", "pt", "de"] as const;
export type AppLocale = (typeof CORE_LOCALES)[number] | (typeof EXTRA_LOCALES)[number];

const extra = (process.env.NEXT_PUBLIC_EXTRA_LOCALES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((l): l is (typeof EXTRA_LOCALES)[number] => (EXTRA_LOCALES as readonly string[]).includes(l));

export const ENABLED_LOCALES: AppLocale[] = [...CORE_LOCALES, ...extra];
export const RTL_LOCALES: AppLocale[] = ["he", "yi"];
export const isRtl = (l: string) => (RTL_LOCALES as string[]).includes(l);
export const dirOf = (l: string): "rtl" | "ltr" => (isRtl(l) ? "rtl" : "ltr");

/** Native names for the language switcher — never translated. */
export const LOCALE_NATIVE: Record<AppLocale, string> = {
  he: "עברית",
  en: "English",
  fr: "Français",
  ru: "Русский",
  yi: "ייִדיש",
  es: "Español",
  pt: "Português",
  de: "Deutsch",
};

/** BCP-47 tags for Intl APIs */
export const INTL_TAG: Record<AppLocale, string> = {
  he: "he-IL",
  en: "en-US",
  fr: "fr-FR",
  ru: "ru-RU",
  yi: "yi",
  es: "es-ES",
  pt: "pt-BR",
  de: "de-DE",
};

export const CURRENCIES = ["USD", "EUR", "ILS", "GBP", "CAD", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];
/** Initial suggestion only — users choose freely; we never assume currency from language. */
export const DEFAULT_CURRENCY: Record<string, Currency> = { he: "ILS", en: "USD", fr: "EUR", ru: "USD", yi: "USD", es: "EUR", pt: "EUR", de: "EUR" };
