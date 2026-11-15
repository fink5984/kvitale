import { Cormorant_Garamond, Frank_Ruhl_Libre, Heebo, Manrope } from "next/font/google";

/**
 * Script coverage (verified by rendering in e2e/i18n.spec.ts screenshots):
 *  - Frank Ruhl Libre: Hebrew + Yiddish (incl. ײַ ﭏ) + Latin  → Hebrew display
 *  - Cormorant Garamond: Latin ext + Cyrillic                    → Latin/Cyrillic display
 *  - Heebo: Hebrew + Latin                                       → Hebrew body
 *  - Manrope: Latin ext + Cyrillic                               → Latin/Cyrillic body
 * Fallback order is set per locale in globals.css, so Hebrew names inside
 * French/Russian pages still render in a Hebrew face.
 */
export const frank = Frank_Ruhl_Libre({ subsets: ["hebrew", "latin"], weight: ["300", "400", "500", "700"], variable: "--font-frank", display: "swap" });
export const cormorant = Cormorant_Garamond({ subsets: ["latin", "latin-ext", "cyrillic"], weight: ["400", "500", "600", "700"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });
export const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });
export const manrope = Manrope({ subsets: ["latin", "latin-ext", "cyrillic"], variable: "--font-manrope", display: "swap" });

export const fontVars = [frank.variable, cormorant.variable, heebo.variable, manrope.variable].join(" ");
