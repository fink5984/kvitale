import { HDate } from "@hebcal/core";

/**
 * The Hebrew date line of a kvittel. ONE implementation for the live preview (browser) and the printer (server),
 * so what the visitor sees is exactly what is printed.
 *  he / yi -> full Hebrew letters, e.g. ו׳ כסלו תשפ״ז
 *  others  -> the Hebrew date in that language
 */
export function hebrewDateString(d: Date, locale: string): string {
  try {
    if (locale === "he" || locale === "yi") return new HDate(d).renderGematriya(true);
    return new HDate(d).render(locale === "ru" ? "ru" : locale === "fr" ? "fr" : "en", false);
  } catch {
    return "";
  }
}
