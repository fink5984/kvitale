import { describe, expect, it } from "vitest";
import { detectDir, findUnsupportedChars, layoutKvittel, PROFILE_58MM_203DPI, stripUnsupported, wrapText, personLine, estimatePaper, needsPaperAlert, rollLengthMm, packRgba, escposRaster } from "../src";
import type { KvittelContent, Measurer } from "../src";

const mono: Measurer = { measure: (f, t) => t.length * f.size * 0.5 };
const base: KvittelContent = { template: "classic", nusach: "he", graveDisplayName: "רבי אלימלך", people: [], topics: [], request: "", showBH: true };

describe("text", () => {
  it("detects direction from first strong char", () => {
    expect(detectDir("123 שלום abc")).toBe("rtl");
    expect(detectDir("Hello שלום")).toBe("ltr");
    expect(detectDir("Привет")).toBe("ltr");
    expect(detectDir("123", "rtl")).toBe("rtl");
  });
  it("reports emoji and keeps niqqud, Yiddish ligatures and Cyrillic", () => {
    expect(findUnsupportedChars("שָׂרָה ײַ Ёлка é 🙏")).toEqual(["🙏"]);
    expect(stripUnsupported("שלום 🙏 עולם")).toBe("שלום עולם");
  });
  it("wraps without losing any character", () => {
    const text = "אחת שתיים שלוש ארבע חמש שש שבע שמונה תשע עשר ".repeat(5).trim();
    const lines = wrapText(text, { size: 20, weight: 400, style: "normal" }, 200, mono);
    expect(lines.join(" ")).toBe(text);
    expect(lines.every((l) => mono.measure({ size: 20, weight: 400, style: "normal" }, l) <= 200)).toBe(true);
  });
  it("hard-breaks very long words by grapheme", () => {
    const w = "א".repeat(80);
    const lines = wrapText(w, { size: 20, weight: 400, style: "normal" }, 200, mono);
    expect(lines.join("")).toBe(w);
    expect(lines.length).toBeGreaterThan(1);
  });
  it("builds person lines in the nusach language, never the UI language", () => {
    expect(personLine({ given: "יוסף", parent: "שרה", relation: "ben", mode: "structured" }, "he")).toBe("יוסף בן שרה");
    expect(personLine({ given: "Иосиф", parent: "Сара", relation: "ben", mode: "structured" }, "ru")).toBe("Иосиф бен Сара");
    expect(personLine({ given: "", relation: "none", mode: "free", freeText: " Free line " }, "en")).toBe("Free line");
  });
});

describe("layout", () => {
  it("blocks empty kvittels and missing grave name", () => {
    const l = layoutKvittel({ ...base, graveDisplayName: "" }, PROFILE_58MM_203DPI, mono);
    expect(l.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["grave_name_empty", "empty"]));
  });
  it("places RTL text right-aligned and inside safe margins", () => {
    const l = layoutKvittel({ ...base, request: "בקשה קצרה" }, PROFILE_58MM_203DPI, mono);
    const ops = l.pages.flatMap((p) => p.ops).filter((o) => o.kind === "text" && o.text === "בקשה קצרה");
    expect(ops[0]).toMatchObject({ align: "right", dir: "rtl", x: 384 - 18 });
  });
  it("paginates long requests and rejects beyond max pages", () => {
    const long = Array.from({ length: 60 }, (_, i) => `שורה מספר ${i} עם טקסט ארוך למדי כדי למלא`).join("\n");
    const l = layoutKvittel({ ...base, request: long }, PROFILE_58MM_203DPI, mono);
    expect(l.pages.length).toBeGreaterThan(1);
    const huge = layoutKvittel({ ...base, request: long.repeat(8) }, PROFILE_58MM_203DPI, mono);
    expect(huge.warnings.find((w) => w.code === "too_long")?.blocking).toBe(true);
  });
  it("is deterministic", () => {
    const c = { ...base, people: [{ id: "a", mode: "structured" as const, given: "יוסף", parent: "שרה", relation: "ben" as const }], request: "טקסט" };
    expect(JSON.stringify(layoutKvittel(c, PROFILE_58MM_203DPI, mono, { reference: "X" }))).toBe(JSON.stringify(layoutKvittel(c, PROFILE_58MM_203DPI, mono, { reference: "X" })));
  });
});

describe("paper accounting", () => {
  it("computes roll length from geometry", () => {
    expect(Math.round(rollLengthMm({ outerDiameterMm: 40, coreDiameterMm: 12, paperThicknessMm: 0.06 }) / 1000)).toBe(19);
  });
  it("alerts on days-to-empty even when percentage is high", () => {
    const e = estimatePaper({ spec: { outerDiameterMm: 40, coreDiameterMm: 12, paperThicknessMm: 0.06 }, usedMm: 2000, avgDailyUsageMm: 4000, demandMultiplier: 1.5 });
    expect(e.remainingPct).toBeGreaterThan(50);
    expect(needsPaperAlert(e, 5)).toEqual({ alert: true, reason: "days_to_empty" });
  });
  it("trusts near-end sensor over estimate", () => {
    const e = estimatePaper({ spec: { outerDiameterMm: 40, coreDiameterMm: 12, paperThicknessMm: 0.06 }, usedMm: 0, nearEndSensor: "near_end" });
    expect(e.remainingPct).toBeLessThanOrEqual(12);
    expect(needsPaperAlert(e, 3).reason).toBe("near_end");
  });
});

describe("raster", () => {
  it("packs 1-bit MSB first and emits GS v 0", () => {
    const w = 16, h = 1;
    const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
    rgba.set([0, 0, 0, 255], 0); // first pixel black
    const r = packRgba(rgba, w, h);
    expect(r.data[0]).toBe(0x80);
    const cmd = escposRaster(r);
    expect(Array.from(cmd.slice(2, 6))).toEqual([0x1d, 0x76, 0x30, 0x00]);
  });
});

describe("simple note (no rules)", () => {
  const simple = (over: Partial<KvittelContent>): KvittelContent => ({ template: "simple", nusach: "he", graveDisplayName: "", people: [{ id: "1", mode: "free", given: "", relation: "none", freeText: "ישראל בן שרה" }], topics: [], request: "", showBH: false, ...over });
  const rules = (l: ReturnType<typeof layoutKvittel>) => l.pages.flatMap((p) => p.ops).filter((o) => o.kind === "rule").length;
  it("needs no tzaddik name and prints a localized title", () => {
    const l = layoutKvittel(simple({}), PROFILE_58MM_203DPI, mono);
    expect(l.warnings.filter((w) => w.blocking)).toEqual([]);
    const titles = l.pages[0]!.ops.filter((o) => o.kind === "text").map((o) => (o.kind === "text" ? o.text : ""));
    expect(titles).toContain("קוויטל");
    expect(layoutKvittel(simple({ nusach: "en" }), PROFILE_58MM_203DPI, mono).pages[0]!.ops.some((o) => o.kind === "text" && o.text === "Kvittel")).toBe(true);
  });
  it("has no ruled lines, and its printed length still follows the text", () => {
    const short = layoutKvittel(simple({ request: "תודה" }), PROFILE_58MM_203DPI, mono);
    const long = layoutKvittel(simple({ request: "בריאות ופרנסה טובה ".repeat(40) }), PROFILE_58MM_203DPI, mono);
    expect(long.totalLengthMm).toBeGreaterThan(short.totalLengthMm);
    expect(rules(short)).toBe(0);
    expect(rules(long)).toBe(0);
    const again = layoutKvittel(simple({ request: "תודה" }), PROFILE_58MM_203DPI, mono);
    expect(again.totalLengthMm).toBe(short.totalLengthMm);
  });
  it("is blocked only when empty", () => {
    const l = layoutKvittel(simple({ people: [] }), PROFILE_58MM_203DPI, mono);
    expect(l.warnings.some((w) => w.code === "empty" && w.blocking)).toBe(true);
  });
});
