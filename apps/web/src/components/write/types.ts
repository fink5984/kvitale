import type { GraveImage } from "@/server/graves";

/** What the writing / checkout screens need to know about a tzaddik. No prices — pricing is quoted only at checkout. */
export interface BuilderGrave {
  slug: string;
  name: string;
  nameHe: string;
  namesByLocale: Record<string, string>;
  place: string | null;
  availability: { kind: string; reason?: string; nextOpenAt?: string | null; testIntake?: boolean };
  cover: GraveImage | null;
}
