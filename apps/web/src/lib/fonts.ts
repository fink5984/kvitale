import { Assistant, Cinzel_Decorative, Cormorant_Garamond, Frank_Ruhl_Libre, Source_Sans_3, Suez_One } from "next/font/google";

/**
 * KVITALE type system (all families are SIL Open Font License, free for web use; self-hosted by next/font).
 *  Display, the voice of a printed sefer:
 *   - Suez One           -> Hebrew + Latin. A high-contrast, weighty display face (fat-face / gold-stamped book-cover feel):
 *                           wordmark, headlines, names of the tzaddikim. One weight: never faux-bolded.
 *   - Cinzel Decorative  -> Latin caps: the KVITALE wordmark in non-Hebrew locales.
 *   - Frank Ruhl Libre   -> Hebrew (with nikud) + Latin. The classic Hebrew book face; companion for weights Bellefair lacks.
 *   - Cormorant Garamond -> Latin / Latin-ext / Cyrillic: a refined old-style serif for en/fr/ru/es/pt/de headlines.
 *  Text, calm and very readable, also used in every input:
 *   - Assistant          -> Hebrew + Latin
 *   - Source Sans 3      -> Latin / Latin-ext / Cyrillic
 * Per-locale fallback order is set in globals.css so Hebrew names inside French/Russian pages still use a Hebrew face.
 */
export const suez = Suez_One({ subsets: ["hebrew", "latin"], weight: "400", variable: "--font-suez", display: "swap" });
export const cinzel = Cinzel_Decorative({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-cinzel", display: "swap" });
export const frank = Frank_Ruhl_Libre({ subsets: ["hebrew", "latin"], weight: ["400", "500", "700", "900"], variable: "--font-frank", display: "swap" });
export const cormorant = Cormorant_Garamond({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });
export const assistant = Assistant({ subsets: ["hebrew", "latin"], variable: "--font-assistant", display: "swap" });
export const sourceSans = Source_Sans_3({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-source", display: "swap" });

export const fontVars = [suez.variable, cinzel.variable, frank.variable, cormorant.variable, assistant.variable, sourceSans.variable].join(" ");
