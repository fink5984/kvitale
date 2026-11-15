import type { NusachLanguage, Relation, TopicId } from "./types";

/**
 * Words printed ON the kvittel. These follow the customer's chosen nusach
 * language — not the UI language — and are part of the print contract, so they
 * live with the layout engine rather than in UI message catalogs.
 */
interface PrintLabels {
  bh: string;
  heading: string;
  /** Title of the plain note ("simple" template), in the language of the kvittel */
  noteTitle: string;
  relation: Record<Exclude<Relation, "none">, string>;
  topicsLead: string;
  topics: Record<TopicId, string>;
  dir: "rtl" | "ltr";
}

export const PRINT_LABELS: Record<NusachLanguage, PrintLabels> = {
  he: {
    bh: "ב״ה",
    heading: "בקשה על ציון",
    noteTitle: "קוויטל",
    relation: { ben: "בן", bat: "בת" },
    topicsLead: "בעניני",
    topics: {
      health: "בריאות",
      livelihood: "פרנסה",
      marriage: "זיווג",
      children: "ילדים",
      success: "הצלחה",
      gratitude: "הודיה",
      general: "כללי",
    },
    dir: "rtl",
  },
  yi: {
    bh: "ב״ה",
    heading: "אַ בקשה בײַם ציון",
    noteTitle: "קוויטל",
    relation: { ben: "בן", bat: "בת" },
    topicsLead: "וועגן",
    topics: {
      health: "געזונט",
      livelihood: "פּרנסה",
      marriage: "זיווג",
      children: "קינדער",
      success: "הצלחה",
      gratitude: "הודיה",
      general: "אַלגעמיין",
    },
    dir: "rtl",
  },
  en: {
    bh: "ב״ה",
    heading: "A petition at the resting place of",
    noteTitle: "Kvittel",
    relation: { ben: "ben", bat: "bat" },
    topicsLead: "Concerning",
    topics: {
      health: "health",
      livelihood: "livelihood",
      marriage: "a match",
      children: "children",
      success: "success",
      gratitude: "gratitude",
      general: "general",
    },
    dir: "ltr",
  },
  fr: {
    bh: "ב״ה",
    heading: "Requête auprès du tombeau de",
    noteTitle: "Kvittel",
    relation: { ben: "ben", bat: "bat" },
    topicsLead: "Au sujet de",
    topics: {
      health: "la santé",
      livelihood: "la subsistance",
      marriage: "un mariage",
      children: "les enfants",
      success: "la réussite",
      gratitude: "la gratitude",
      general: "général",
    },
    dir: "ltr",
  },
  ru: {
    bh: "ב״ה",
    heading: "Записка у могилы праведника",
    noteTitle: "Квитл",
    relation: { ben: "бен", bat: "бат" },
    topicsLead: "Темы",
    topics: {
      health: "здоровье",
      livelihood: "заработок",
      marriage: "пара",
      children: "дети",
      success: "успех",
      gratitude: "благодарность",
      general: "общее",
    },
    dir: "ltr",
  },
  es: {
    bh: "ב״ה",
    heading: "Petición ante la tumba de",
    noteTitle: "Kvittel",
    relation: { ben: "ben", bat: "bat" },
    topicsLead: "Acerca de",
    topics: {
      health: "salud",
      livelihood: "sustento",
      marriage: "pareja",
      children: "hijos",
      success: "éxito",
      gratitude: "gratitud",
      general: "general",
    },
    dir: "ltr",
  },
  pt: {
    bh: "ב״ה",
    heading: "Pedido junto ao túmulo de",
    noteTitle: "Kvittel",
    relation: { ben: "ben", bat: "bat" },
    topicsLead: "Sobre",
    topics: {
      health: "saúde",
      livelihood: "sustento",
      marriage: "casamento",
      children: "filhos",
      success: "sucesso",
      gratitude: "gratidão",
      general: "geral",
    },
    dir: "ltr",
  },
  de: {
    bh: "ב״ה",
    heading: "Bitte am Grab von",
    noteTitle: "Kvittel",
    relation: { ben: "ben", bat: "bat" },
    topicsLead: "Betreffend",
    topics: {
      health: "Gesundheit",
      livelihood: "Parnasse",
      marriage: "Partnerschaft",
      children: "Kinder",
      success: "Erfolg",
      gratitude: "Dank",
      general: "Allgemeines",
    },
    dir: "ltr",
  },
};

export function personLine(
  p: { given: string; parent?: string; relation: Relation; freeText?: string; mode: "structured" | "free" },
  nusach: NusachLanguage,
): string {
  if (p.mode === "free") return (p.freeText ?? "").trim();
  const given = p.given.trim();
  const parent = (p.parent ?? "").trim();
  if (!parent || p.relation === "none") return given;
  return `${given} ${PRINT_LABELS[nusach].relation[p.relation]} ${parent}`;
}
