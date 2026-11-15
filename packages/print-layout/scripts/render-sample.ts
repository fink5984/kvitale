import { writeFileSync, mkdirSync } from "node:fs";
import { renderKvittel } from "../src/node";
import type { KvittelContent } from "../src/types";

const samples: Record<string, KvittelContent> = {
  he: {
    template: "classic", nusach: "he", graveDisplayName: "רבי ישעיה מקרעסטיר", showBH: true,
    people: [
      { id: "1", mode: "structured", given: "יוסף חיים", parent: "שָׂרָה", relation: "ben" },
      { id: "2", mode: "structured", given: "רחל לאה", parent: "מרים", relation: "bat" },
      { id: "3", mode: "free", given: "", relation: "none", freeText: "Michael ben David (מיכאל)" },
    ],
    topics: ["health", "livelihood"],
    request: "שתהיה לנו שנה טובה ומבורכת, ובריאות שלמה לכל המשפחה.\n\nתודה על כל הטוב. הזמנה 2026 / ref A-17.",
    signature: "משפחת כהן",
  },
  ru: {
    template: "arch", nusach: "ru", graveDisplayName: "Ребе Элимелех из Лиженска", showBH: true,
    people: [{ id: "1", mode: "structured", given: "Александр", parent: "Светлана", relation: "ben" }],
    topics: ["children", "success"],
    request: "Пусть будет здоровье и мир в нашем доме. Благодарим за всё доброе — שלום.",
  },
  fr: {
    template: "minimal", nusach: "fr", graveDisplayName: "Rabbi Isaïe de Kerestir", showBH: false,
    people: [{ id: "1", mode: "structured", given: "Élodie-Joséphine", parent: "Béatrice", relation: "bat" }],
    topics: ["gratitude"],
    request: "Pour la santé et la réussite de toute la famille, avec reconnaissance.",
  },
};
mkdirSync("out", { recursive: true });
for (const [k, c] of Object.entries(samples)) {
  const r = await renderKvittel(c, { dateLine: "כ״ב חשון תשפ״ז", reference: "K7F3A" });
  r.pngs.forEach((p, i) => writeFileSync(`out/${k}-${i + 1}.png`, p));
  console.log(k, r.layout.pages.length, "pages", r.layout.totalLengthMm, "mm", JSON.stringify(r.layout.warnings));
}
