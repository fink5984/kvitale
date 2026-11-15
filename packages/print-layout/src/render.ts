import { cssFont } from "./layout";
import type { DrawOp, FontSpec, LayoutPage, Measurer } from "./types";

/** Minimal 2D context surface implemented by both browser canvas and @napi-rs/canvas. */
export interface Ctx2D {
  font: string;
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  textAlign: string;
  textBaseline: string;
  direction: string;
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
  measureText(text: string): { width: number };
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, s: number, e: number): void;
  closePath(): void;
  stroke(): void;
  fill(): void;
  drawImage(img: unknown, x: number, y: number, w: number, h: number): void;
}

export function createCanvasMeasurer(ctx: Ctx2D): Measurer {
  const cache = new Map<string, number>();
  return {
    measure(font: FontSpec, text: string) {
      const f = cssFont(font);
      const key = `${f}|${text}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      ctx.font = f;
      const w = ctx.measureText(text).width;
      cache.set(key, w);
      return w;
    },
  };
}

export interface RenderOptions {
  ink?: string;
  paper?: string;
  /** Device pixels per dot — 1 for print, 2–3 for crisp previews */
  scale?: number;
  images?: Record<string, unknown>;
}

export function renderPage(ctx: Ctx2D, page: LayoutPage, widthDots: number, opts: RenderOptions = {}): void {
  const ink = opts.ink ?? "#000";
  const paper = opts.paper ?? "#fff";
  const s = opts.scale ?? 1;
  ctx.save();
  ctx.scale(s, s);
  if (paper !== "transparent") {
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, widthDots, page.heightDots);
  }
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  ctx.textBaseline = "alphabetic";
  for (const op of page.ops) drawOp(ctx, op, ink, opts.images);
  ctx.restore();
}

function drawOp(ctx: Ctx2D, op: DrawOp, ink: string, images?: Record<string, unknown>) {
  switch (op.kind) {
    case "text": {
      ctx.font = cssFont(op.font);
      ctx.direction = op.dir;
      ctx.textAlign = op.align;
      ctx.fillText(op.text, op.x, op.y);
      return;
    }
    case "rule": {
      ctx.fillRect(op.x1, op.y, op.x2 - op.x1, op.thickness);
      return;
    }
    case "image": {
      const img = images?.[op.ref];
      if (img) ctx.drawImage(img, op.x, op.y, op.width, op.height);
      else {
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(op.x, op.y);
        ctx.lineTo(op.x + op.width, op.y + op.height);
        ctx.moveTo(op.x + op.width, op.y);
        ctx.lineTo(op.x, op.y + op.height);
        ctx.stroke();
      }
      return;
    }
    case "ornament":
      drawOrnament(ctx, op.name, op.cx, op.cy, op.size, ink);
  }
}

/** Fine-line ornaments, drawn as vector paths so preview and print are identical. */
function drawOrnament(ctx: Ctx2D, name: "arch" | "diamond" | "flourish", cx: number, cy: number, size: number, ink: string) {
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  if (name === "diamond") {
    const r = size / 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(cx - r * 6, cy - 1, r * 4, 2);
    ctx.fillRect(cx + r * 2, cy - 1, r * 4, 2);
    return;
  }
  if (name === "flourish") {
    const w = size * 5;
    const h = size / 2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - w, cy);
    ctx.bezierCurveTo(cx - w * 0.6, cy - h, cx - w * 0.3, cy + h, cx - size * 0.45, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + w, cy);
    ctx.bezierCurveTo(cx + w * 0.6, cy - h, cx + w * 0.3, cy + h, cx + size * 0.45, cy);
    ctx.stroke();
    const r = size * 0.28;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    return;
  }
  // arch: a Jerusalem-stone style pointed arch outline with keystone
  const w = size * 1.5;
  const h = size;
  const top = cy - h / 2;
  const bottom = cy + h / 2;
  ctx.lineWidth = 2;
  for (const inset of [0, 6]) {
    const ww = w / 2 - inset;
    ctx.beginPath();
    ctx.moveTo(cx - ww, bottom);
    ctx.lineTo(cx - ww, top + h * 0.5);
    ctx.quadraticCurveTo(cx - ww, top + inset, cx, top + inset);
    ctx.quadraticCurveTo(cx + ww, top + inset, cx + ww, top + h * 0.5);
    ctx.lineTo(cx + ww, bottom);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(cx, top + h * 0.48, size * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(cx - w * 1.1, bottom - 1, w * 0.45, 2);
  ctx.fillRect(cx + w * 0.65, bottom - 1, w * 0.45, 2);
}
