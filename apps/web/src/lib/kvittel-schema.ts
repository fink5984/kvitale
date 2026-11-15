import { z } from "zod";

/** Limits are enforced client-side for UX and again server-side as the source of truth. */
export const LIMITS = { people: 40, nameChars: 120, requestChars: 3000, signatureChars: 120, graveNameChars: 120, cartEntries: 10, gravesPerEntry: 8 } as const;

export const personSchema = z.object({
  id: z.string().min(1).max(64),
  mode: z.enum(["structured", "free"]),
  given: z.string().max(LIMITS.nameChars),
  parent: z.string().max(LIMITS.nameChars).optional(),
  relation: z.enum(["ben", "bat", "none"]),
  freeText: z.string().max(LIMITS.nameChars * 2).optional(),
});

export const kvittelContentSchema = z.object({
  template: z.enum(["simple", "classic", "minimal", "arch"]),
  nusach: z.enum(["he", "yi", "en", "fr", "ru", "es", "pt", "de"]),
  graveDisplayName: z.string().max(LIMITS.graveNameChars),
  people: z.array(personSchema).max(LIMITS.people),
  topics: z.array(z.enum(["health", "livelihood", "marriage", "children", "success", "gratitude", "general"])).max(7),
  request: z.string().max(LIMITS.requestChars),
  signature: z.string().max(LIMITS.signatureChars).optional(),
  showBH: z.boolean(),
  handwritingRef: z.string().max(80).optional(),
  handwritingSize: z.object({ width: z.number().int().positive().max(5000), height: z.number().int().positive().max(8000) }).optional(),
});
export type KvittelContentInput = z.infer<typeof kvittelContentSchema>;

export const cartEntrySchema = z.object({
  id: z.string().min(1).max(64),
  graveSlugs: z.array(z.string().min(1).max(80)).min(1).max(LIMITS.gravesPerEntry),
  /** Per-grave display name overrides when one kvittel goes to several graves */
  content: kvittelContentSchema,
});
export type CartEntry = z.infer<typeof cartEntrySchema>;

export const checkoutSchema = z.object({
  entries: z.array(cartEntrySchema).min(1).max(LIMITS.cartEntries),
  email: z.email().max(200),
  currency: z.enum(["USD", "EUR", "ILS", "GBP", "CAD", "AUD"]),
  coupon: z.string().max(40).optional(),
  marketingConsent: z.boolean(),
  acceptTerms: z.literal(true),
  acceptSchedule: z.boolean().optional(),
  locale: z.string().min(2).max(5),
  /** Generated once per checkout attempt on the client; repeats never create a second order */
  idempotencyKey: z.string().min(16).max(80).optional(),
  /** honeypot — must stay empty */
  website: z.string().max(0).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
