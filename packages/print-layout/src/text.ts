import type { Dir, FontSpec, Measurer } from "./types";

const RTL_STRONG = /[֐-׿יִ-ﭏ؀-ۿ]/;
const LTR_STRONG = /[A-Za-zÀ-ɏЀ-ӿͰ-Ͽ]/;

/** Base direction of a paragraph from its first strong character (UAX#9 P2/P3). */
export function detectDir(text: string, fallback: Dir = "ltr"): Dir {
  for (const ch of text) {
    if (RTL_STRONG.test(ch)) return "rtl";
    if (LTR_STRONG.test(ch)) return "ltr";
  }
  return fallback;
}

/**
 * Characters the print fonts actually cover. Anything outside is reported
 * transparently to the customer instead of silently dropped or replaced.
 */
const SUPPORTED_RANGES: Array<[number, number]> = [
  [0x0009, 0x000a],
  [0x0020, 0x007e], // Basic Latin
  [0x00a0, 0x017f], // Latin-1 + Extended-A
  [0x0180, 0x024f], // Latin Extended-B
  [0x02b0, 0x02ff], // Spacing modifiers
  [0x0300, 0x036f], // Combining diacritics
  [0x0400, 0x04ff], // Cyrillic
  [0x0500, 0x052f], // Cyrillic supplement
  [0x0591, 0x05c7], // Hebrew points & cantillation
  [0x05d0, 0x05ea], // Hebrew letters
  [0x05ef, 0x05f4], // Yiddish ligatures, geresh, gershayim
  [0xfb1d, 0xfb4f], // Hebrew presentation forms (Yiddish)
  [0x1e00, 0x1eff], // Latin extended additional
  [0x2010, 0x2027], // dashes, quotes, bullets, ellipsis
  [0x2030, 0x203a],
  [0x20aa, 0x20ac], // ₪ €
  [0x2116, 0x2116], // №
  [0x200e, 0x200f], // LRM/RLM
];

export function isSupportedChar(cp: number): boolean {
  for (const [a, b] of SUPPORTED_RANGES) if (cp >= a && cp <= b) return true;
  return false;
}

export function findUnsupportedChars(text: string): string[] {
  const found = new Set<string>();
  for (const seg of graphemes(text)) {
    for (const ch of seg) {
      const cp = ch.codePointAt(0)!;
      if (cp === 0x0d) continue;
      if (!isSupportedChar(cp)) {
        found.add(seg);
        break;
      }
    }
  }
  return [...found];
}

/** Remove unsupported graphemes — only ever called on explicit user action. */
export function stripUnsupported(text: string): string {
  return graphemes(text)
    .filter((seg) => [...seg].every((ch) => ch.codePointAt(0) === 0x0d || isSupportedChar(ch.codePointAt(0)!)))
    .join("")
    .replace(/[ \t]{2,}/g, " ");
}

let segmenter: Intl.Segmenter | null = null;
export function graphemes(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    segmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/** Normalisation used for printing only. The stored original is never modified. */
export function normalizeForPrint(text: string): string {
  return text
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[​﻿]/g, "")
    .replace(/[ \t]+$/gm, "");
}

/**
 * Greedy line breaking by words, with grapheme-level breaks for words wider than
 * the line. Measurement is delegated to the real font so preview == print.
 */
export function wrapText(text: string, font: FontSpec, maxWidth: number, m: Measurer): string[] {
  const out: string[] = [];
  const words = text.split(/[ \t]+/).filter((w) => w.length > 0);
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (m.measure(font, candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) out.push(line);
    line = "";
    if (m.measure(font, word) <= maxWidth) {
      line = word;
      continue;
    }
    // Hard break a single long word by graphemes.
    let chunk = "";
    for (const g of graphemes(word)) {
      if (m.measure(font, chunk + g) > maxWidth && chunk) {
        out.push(chunk);
        chunk = g;
      } else chunk += g;
    }
    line = chunk;
  }
  if (line) out.push(line);
  return out;
}

export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n/)
    .map((p) => p.trim())
    .reduce<string[]>((acc, p) => {
      // keep single blank lines as paragraph separators, collapse runs
      if (p === "" && (acc.length === 0 || acc[acc.length - 1] === "")) return acc;
      acc.push(p);
      return acc;
    }, [])
    .filter((p, i, arr) => !(p === "" && i === arr.length - 1));
}
