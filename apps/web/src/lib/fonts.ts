import { Assistant, David_Libre, Playfair_Display, Source_Sans_3 } from "next/font/google";

/**
 * KVITALE type system.
 *  Display (character, traditional):
 *   - David Libre      → Hebrew + Latin: a classic printed-sefer face for Hebrew headlines
 *   - Playfair Display → Latin / Latin-ext / Cyrillic headlines (high-contrast, book-like)
 *  Text (calm, very readable — also used in every input):
 *   - Assistant        → Hebrew + Latin
 *   - Source Sans 3    → Latin / Latin-ext / Cyrillic
 * Per-locale fallback order is set in globals.css so Hebrew names inside
 * French/Russian pages still render in a Hebrew face.
 */
export const david = David_Libre({ subsets: ["hebrew", "latin"], weight: ["400", "500", "700"], variable: "--font-david", display: "swap" });
export const playfair = Playfair_Display({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-playfair", display: "swap" });
export const assistant = Assistant({ subsets: ["hebrew", "latin"], variable: "--font-assistant", display: "swap" });
export const sourceSans = Source_Sans_3({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-source", display: "swap" });

export const fontVars = [david.variable, playfair.variable, assistant.variable, sourceSans.variable].join(" ");
