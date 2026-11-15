import { PRINT_LABELS, personLine } from "./labels";
import { detectDir, findUnsupportedChars, normalizeForPrint, splitParagraphs, wrapText } from "./text";
import type {
  Dir,
  DrawOp,
  FontSpec,
  KvittelContent,
  KvittelLayout,
  LayoutOptions,
  LayoutPage,
  LayoutWarning,
  Measurer,
  PrinterProfile,
} from "./types";

export const ENGINE_VERSION = "1.0.0";

/** 58mm paper, 203dpi head, 48mm printable — the common profile of the candidate printers. */
export const PROFILE_58MM_203DPI: PrinterProfile = {
  id: "thermal-58mm-203dpi",
  label: "Thermal 58mm · 203dpi · 384 dots",
  dotsPerMm: 8,
  paperWidthMm: 58,
  printableWidthDots: 384,
  marginDots: 18,
  maxPageDots: 2000, // 250mm per slip
  maxPages: 4,
  feedBeforeCutMm: 12,
};

export const FONT_FAMILY = `"KvittelSerifHebrew", "KvittelSerif", serif`;

const F = {
  tiny: { size: 16, weight: 400, style: "normal" } as FontSpec,
  small: { size: 19, weight: 400, style: "normal" } as FontSpec,
  body: { size: 23, weight: 400, style: "normal" } as FontSpec,
  name: { size: 26, weight: 700, style: "normal" } as FontSpec,
  title: { size: 32, weight: 700, style: "normal" } as FontSpec,
};

export function cssFont(f: FontSpec): string {
  return `${f.style === "italic" ? "italic " : ""}${f.weight} ${f.size}px ${FONT_FAMILY}`;
}

interface Block {
  height: number;
  ops: DrawOp[]; // y relative to block top
  /** keep with next block when paginating (headings) */
  keepWithNext?: boolean;
}

const lh = (f: FontSpec) => Math.round(f.size * 1.5);
const baseline = (f: FontSpec) => Math.round(lh(f) * 0.7);

export function layoutKvittel(
  content: KvittelContent,
  profile: PrinterProfile,
  m: Measurer,
  opts: LayoutOptions = {},
): KvittelLayout {
  const W = profile.printableWidthDots;
  const L = profile.marginDots;
  const R = W - profile.marginDots;
  const CW = R - L;
  const CX = Math.round(W / 2);
  const labels = PRINT_LABELS[content.nusach];
  const baseDir: Dir = labels.dir;
  const warnings: LayoutWarning[] = [];
  const blocks: Block[] = [];

  const graveName = normalizeForPrint(content.graveDisplayName).trim();
  const people = content.people
    .map((p) => normalizeForPrint(personLine(p, content.nusach)))
    .filter((s) => s.length > 0);
  const request = normalizeForPrint(content.request ?? "");
  const signature = normalizeForPrint(content.signature ?? "").trim();

  // ---- validation (transparent, never silent) ----
  if (!graveName) warnings.push({ code: "grave_name_empty", blocking: true });
  if (people.length === 0 && request.trim() === "" && !content.handwritingRef)
    warnings.push({ code: "empty", blocking: true });
  const missingParent = content.people.filter((p) => p.mode === "structured" && p.given.trim() && !(p.parent ?? "").trim());
  if (missingParent.length) warnings.push({ code: "name_missing_parent", blocking: false, detail: String(missingParent.length) });
  const bad = findUnsupportedChars([graveName, ...people, request, signature].join("\n"));
  if (bad.length) warnings.push({ code: "unsupported_chars", blocking: true, chars: bad });

  // ---- helpers ----
  const space = (h: number) => blocks.push({ height: h, ops: [] });
  const textLines = (text: string, font: FontSpec, align: "start" | "center" | "end", fallbackDir: Dir = baseDir, keep = false) => {
    const dir = detectDir(text, fallbackDir);
    for (const line of wrapText(text, font, CW, m)) {
      let x: number;
      let a: "left" | "right" | "center";
      if (align === "center") {
        x = CX;
        a = "center";
      } else {
        const startRight = dir === "rtl";
        const right = align === "start" ? startRight : !startRight;
        x = right ? R : L;
        a = right ? "right" : "left";
      }
      blocks.push({ height: lh(font), ops: [{ kind: "text", x, y: baseline(font), text: line, font, align: a, dir }], keepWithNext: keep });
    }
  };
  const rule = (inset = 0, thickness = 2, pad = 10) =>
    blocks.push({ height: pad * 2 + thickness, ops: [{ kind: "rule", x1: L + inset, x2: R - inset, y: pad, thickness }] });
  const ornament = (name: "arch" | "diamond" | "flourish", size: number, pad = 8) =>
    blocks.push({ height: size + pad * 2, ops: [{ kind: "ornament", name, cx: CX, cy: pad + size / 2, size }] });

  // ---- composition ----
  space(10);
  if (content.showBH) {
    // ב״ה always sits at the top-right, per custom, regardless of language.
    blocks.push({ height: lh(F.small), ops: [{ kind: "text", x: R, y: baseline(F.small), text: labels.bh, font: F.small, align: "right", dir: "rtl" }] });
  }
  if (content.template === "arch") ornament("arch", 64, 6);
  else if (content.template === "classic") ornament("arch", 40, 4);
  else space(6);

  textLines(labels.heading, F.small, "center", baseDir, true);
  if (graveName) textLines(graveName, F.title, "center", detectDir(graveName, baseDir), true);

  if (content.template === "minimal") rule(CW / 3, 2, 12);
  else ornament("flourish", 22, 10);

  if (people.length) {
    for (const p of people) textLines(p, F.name, "center", detectDir(p, baseDir));
    space(6);
  }

  if (content.topics.length) {
    const sep = " · ";
    const t = `${labels.topicsLead}: ${content.topics.map((k) => labels.topics[k]).join(sep)}`;
    textLines(t, F.small, "center", baseDir);
    space(4);
  }

  if (request.trim()) {
    if (people.length || content.topics.length) {
      if (content.template === "minimal") rule(CW / 2.5, 1, 10);
      else ornament("diamond", 12, 10);
    }
    for (const para of splitParagraphs(request)) {
      if (para === "") {
        space(Math.round(lh(F.body) * 0.5));
        continue;
      }
      textLines(para, F.body, "start", detectDir(para, baseDir));
    }
  }

  if (content.handwritingRef && content.handwritingSize) {
    const { width, height } = content.handwritingSize;
    const w = W - 8;
    const h = Math.max(1, Math.round((w * height) / Math.max(1, width)));
    space(10);
    blocks.push({ height: h, ops: [{ kind: "image", ref: content.handwritingRef, x: 4, y: 0, width: w, height: h }] });
  }

  if (signature) {
    space(14);
    textLines(signature, F.body, "end", detectDir(signature, baseDir));
  }

  // footer
  space(10);
  if (content.template !== "minimal") ornament("flourish", 16, 6);
  else rule(CW / 3, 1, 8);
  const footer = [opts.dateLine, opts.reference].filter(Boolean).join("  ·  ");
  if (footer) textLines(footer, F.tiny, "center", detectDir(footer, baseDir));
  space(8);

  // ---- pagination ----
  const pages = paginate(blocks, profile);
  if (pages.length > profile.maxPages)
    warnings.push({ code: "too_long", blocking: true, detail: `${pages.length}/${profile.maxPages}` });

  if (pages.length > 1) {
    pages.forEach((pg, i) => {
      const t = `${i + 1}/${pages.length}`;
      pg.ops.push({ kind: "text", x: L, y: pg.heightDots + baseline(F.tiny), text: t, font: F.tiny, align: "left", dir: "ltr" });
      pg.heightDots += lh(F.tiny);
    });
  }

  const totalDots = pages.reduce((s, p) => s + p.heightDots, 0);
  return {
    profileId: profile.id,
    widthDots: W,
    pages,
    totalLengthMm: Math.round((totalDots / profile.dotsPerMm + pages.length * profile.feedBeforeCutMm) * 10) / 10,
    warnings,
    engineVersion: ENGINE_VERSION,
  };
}

function paginate(blocks: Block[], profile: PrinterProfile): LayoutPage[] {
  const max = profile.maxPageDots - 40; // reserve for page number footer
  const pages: LayoutPage[] = [];
  let cur: LayoutPage = { index: 0, heightDots: 0, ops: [] };
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]!;
    let need = b.height;
    if (b.keepWithNext && blocks[i + 1]) need += blocks[i + 1]!.height;
    if (cur.heightDots + need > max && cur.heightDots > 0) {
      pages.push(cur);
      cur = { index: pages.length, heightDots: 0, ops: [] };
    }
    for (const op of b.ops) cur.ops.push(offset(op, cur.heightDots));
    cur.heightDots += b.height;
  }
  if (cur.heightDots > 0) pages.push(cur);
  return pages;
}

function offset(op: DrawOp, dy: number): DrawOp {
  switch (op.kind) {
    case "text":
      return { ...op, y: op.y + dy };
    case "rule":
      return { ...op, y: op.y + dy };
    case "ornament":
      return { ...op, cy: op.cy + dy };
    case "image":
      return { ...op, y: op.y + dy };
  }
}

export function isPrintable(layout: KvittelLayout): boolean {
  return !layout.warnings.some((w) => w.blocking);
}
