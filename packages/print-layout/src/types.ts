/**
 * Kvittel print layout — shared types.
 *
 * The same layout engine produces both the on-screen preview (browser canvas)
 * and the 1-bit raster sent to the thermal printer (server canvas). Never fork
 * layout rules between the two: change them here.
 */

export type NusachLanguage = "he" | "yi" | "en" | "fr" | "ru" | "es" | "pt" | "de";

export type TopicId = "health" | "livelihood" | "marriage" | "children" | "success" | "gratitude" | "general";

export type Relation = "ben" | "bat" | "none";

/** "simple" = the plain ruled-paper note (default). The others are legacy layouts kept so existing orders still render identically. */
export type TemplateId = "simple" | "classic" | "minimal" | "arch";

export interface KvittelPerson {
  id: string;
  /** Structured mode: given name, e.g. "יוסף" */
  given: string;
  /** Mother's or father's name, as the customer chooses */
  parent?: string;
  relation: Relation;
  /** Free mode: the full line exactly as typed */
  freeText?: string;
  mode: "structured" | "free";
}

export interface KvittelContent {
  template: TemplateId;
  /** Language used for connective words printed on the slip (ben/bat, headings). Never derived from UI locale automatically. */
  nusach: NusachLanguage;
  /** The tzaddik's name exactly as it will be printed. Never auto-transliterated. */
  graveDisplayName: string;
  people: KvittelPerson[];
  topics: TopicId[];
  /** Free text request — paragraphs separated by blank lines. First-class; suggestions are optional. */
  request: string;
  /** Optional signature line, e.g. family name */
  signature?: string;
  /** Print the customary ב״ה mark at the top */
  showBH: boolean;
  /** Optional handwritten page, attached as an image reference id */
  handwritingRef?: string;
  handwritingSize?: { width: number; height: number };
}

export interface PrinterProfile {
  id: string;
  label: string;
  /** Physical dots per mm (203dpi ≈ 8 dots/mm) */
  dotsPerMm: number;
  paperWidthMm: number;
  /** Printable width in dots (e.g. 384 for 48mm @ 203dpi) */
  printableWidthDots: number;
  /** Safe horizontal margin inside the printable area, in dots */
  marginDots: number;
  /** Max height of one slip in dots before a page break is required */
  maxPageDots: number;
  /** Max number of slips per kvittel before validation rejects */
  maxPages: number;
  /** Feed after print, before cut, in mm */
  feedBeforeCutMm: number;
}

export interface FontSpec {
  size: number;
  weight: 400 | 700;
  style: "normal" | "italic";
}

export type Align = "start" | "center" | "end";
export type Dir = "rtl" | "ltr";

export type DrawOp =
  | { kind: "text"; x: number; y: number; text: string; font: FontSpec; align: "left" | "right" | "center"; dir: Dir }
  | { kind: "rule"; x1: number; x2: number; y: number; thickness: number }
  | { kind: "ornament"; name: "arch" | "diamond" | "flourish"; cx: number; cy: number; size: number }
  | { kind: "image"; ref: string; x: number; y: number; width: number; height: number };

export interface LayoutPage {
  index: number;
  heightDots: number;
  ops: DrawOp[];
}

export type LayoutWarningCode =
  | "unsupported_chars"
  | "too_long"
  | "empty"
  | "name_missing_parent"
  | "grave_name_empty";

export interface LayoutWarning {
  code: LayoutWarningCode;
  /** Blocking warnings prevent checkout */
  blocking: boolean;
  detail?: string;
  chars?: string[];
}

export interface KvittelLayout {
  profileId: string;
  widthDots: number;
  pages: LayoutPage[];
  /** Total printed length including feed, in mm — used for paper accounting */
  totalLengthMm: number;
  warnings: LayoutWarning[];
  engineVersion: string;
}

export interface Measurer {
  measure(font: FontSpec, text: string): number;
}

export interface LayoutOptions {
  /** Pre-formatted date line printed at the foot (e.g. Hebrew date). Passed in for determinism. */
  dateLine?: string;
  /** Short non-personal reference printed in the footer, e.g. "K7F3A" */
  reference?: string;
}
