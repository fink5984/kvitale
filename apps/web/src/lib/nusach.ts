import type { NusachLanguage } from "@kvittel/print-layout";

/**
 * The note's own language (title, direction) follows what the person actually writes,
 * not the site language: Hebrew letters → Hebrew note, Cyrillic → Russian, Latin → the
 * site language when it is a Latin one (fr) else English. With nothing typed yet, the site language decides.
 */
export function detectNusach(text: string, uiLocale: string): NusachLanguage {
  let he = 0;
  let cyr = 0;
  let lat = 0;
  for (const ch of text) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x0590 && c <= 0x05ff) he++;
    else if (c >= 0x0400 && c <= 0x04ff) cyr++;
    else if ((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0xc0 && c <= 0x24f)) lat++;
  }
  const total = he + cyr + lat;
  if (total === 0) return uiDefault(uiLocale);
  if (he >= cyr && he >= lat) return "he";
  if (cyr >= lat) return "ru";
  return uiLocale === "fr" ? "fr" : uiLocale === "es" || uiLocale === "pt" || uiLocale === "de" ? (uiLocale as NusachLanguage) : "en";
}

export function uiDefault(uiLocale: string): NusachLanguage {
  return (["he", "yi", "ru", "fr", "es", "pt", "de"] as string[]).includes(uiLocale) ? (uiLocale as NusachLanguage) : "en";
}
