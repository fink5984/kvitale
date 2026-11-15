/**
 * Search normalisation shared by indexing (seed/CMS) and querying.
 * - lowercases, strips Latin diacritics (accent folding)
 * - strips Hebrew niqqud & cantillation, folds final letters, gershayim/geresh
 * - folds Yiddish digraphs/ligatures to base letters
 * - folds Cyrillic ё→е, й→и
 * - removes punctuation, collapses whitespace
 */
export function normalizeSearch(input: string): string {
  let s = input.normalize("NFKD").toLowerCase();
  s = s.replace(/[̀-ͯ]/g, ""); // Latin combining marks
  s = s.replace(/[֑-ׇ]/g, ""); // Hebrew points/cantillation
  s = s
    .replace(/װ/g, "וו")
    .replace(/ױ/g, "וי")
    .replace(/ײ/g, "יי")
    .replace(/ך/g, "כ")
    .replace(/ם/g, "מ")
    .replace(/ן/g, "נ")
    .replace(/ף/g, "פ")
    .replace(/ץ/g, "צ");
  s = s.replace(/ё/g, "е").replace(/й/g, "и");
  s = s.replace(/[׳״'"`’‘“”.,()\-–—_/\:;!?·]/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

export function scriptOf(s: string): "hebrew" | "cyrillic" | "latin" {
  if (/[֐-׿]/.test(s)) return "hebrew";
  if (/[Ѐ-ӿ]/.test(s)) return "cyrillic";
  return "latin";
}
