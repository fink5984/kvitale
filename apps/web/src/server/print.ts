import "server-only";
import path from "node:path";
import { repoRoot } from "@kvittel/db";
import { registerPrintFonts, renderKvittel } from "@kvittel/print-layout/node";
import type { KvittelContent } from "@kvittel/print-layout";
import { hebrewDateString } from "./schedule";
import { storage } from "./storage";

let ready = false;
function ensureFonts() {
  if (ready) return;
  registerPrintFonts(process.env.KVITTEL_FONTS_DIR || path.join(repoRoot(), "packages", "print-layout", "fonts"));
  ready = true;
}

export async function loadHandwriting(ref: string | undefined): Promise<Record<string, Buffer>> {
  if (!ref) return {};
  const buf = await storage.get(`handwriting/${ref}`);
  return buf ? { [ref]: buf } : {};
}

/** Authoritative server render — determines page count, length and blocking warnings. */
export async function renderServer(content: KvittelContent, opts: { reference?: string; at?: Date } = {}) {
  ensureFonts();
  const images = await loadHandwriting(content.handwritingRef);
  return renderKvittel(content, { dateLine: hebrewDateString(opts.at ?? new Date(), content.nusach === "he" || content.nusach === "yi" ? "he" : content.nusach), reference: opts.reference, images });
}
