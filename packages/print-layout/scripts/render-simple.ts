import { writeFileSync, mkdirSync } from "node:fs";
import { renderKvittel } from "../src/node";
import type { KvittelContent } from "../src/types";
const base = { template: "simple" as const, graveDisplayName: "", topics: [], showBH: false };
const person = (t: string, i = 1) => ({ id: String(i), mode: "free" as const, given: "", relation: "none" as const, freeText: t });
const samples: Record<string, KvittelContent> = {
  he: { ...base, nusach: "he", people: [person("ישראל בן שרה"), person("רחל בת לאה", 2)], request: "לרפואה שלמה, פרנסה טובה ושלום בית. שנזכה לראות נחת מכל הילדים." },
  heLong: { ...base, nusach: "he", people: [person("ישראל בן שרה")], request: "שתהיה לנו שנה טובה ומבורכת, ובריאות שלמה לכל המשפחה.\n\nתודה על כל הטוב. ".repeat(6) },
  ru: { ...base, nusach: "ru", people: [person("Александр сын Светланы")], request: "Пусть будет здоровье и мир в нашем доме. Благодарим за всё доброе." },
  en: { ...base, nusach: "en", people: [person("Yisroel ben Sarah")], request: "For a complete healing and a good livelihood." },
  short: { ...base, nusach: "he", people: [person("דוד")], request: "" },
};
mkdirSync("out", { recursive: true });
for (const [k, c] of Object.entries(samples)) {
  const r = await renderKvittel(c, { dateLine: "כ״ב חשון תשפ״ז", reference: "K7F3A" });
  r.pngs.forEach((p, i) => writeFileSync(`out/simple-${k}-${i + 1}.png`, p));
  console.log(k, r.layout.pages.length, "pages", r.layout.totalLengthMm, "mm", JSON.stringify(r.layout.warnings));
}
