/**
 * Real tziyunim (NOT demo): Kerestir, Lizhensk, Berditchev, Uman, Radomsk.
 *
 *   pnpm db:seed:graves [--yes]     # --yes is required when DATABASE_URL is set
 *
 * Insert-only and idempotent: a slug that already exists is left untouched.
 * All graves start as `coming_soon` — a tzaddik becomes sellable only after a real device,
 * permit and caretaker exist and an admin switches the status. Nothing here is presented as
 * verified: hilula dates are flagged unverified (hidden publicly), translations reviewed=false,
 * no coordinates, no service hours, no photos (use `pnpm db:import-photos`).
 */
import { createDb } from "../src/client";
import { describeDatabaseUrl, loadLocalEnv } from "../src/env-file";
import { normalizeSearch, scriptOf } from "../src/normalize";
import * as s from "../src/schema";
import { SEED_GRAVES, type SeedGrave } from "./seed-data";

loadLocalEnv();
console.log(`→ target: ${describeDatabaseUrl(process.env.DATABASE_URL)}`);
if (process.env.DATABASE_URL && !process.argv.includes("--yes")) {
  console.error("Refusing to touch a DATABASE_URL database without --yes.");
  process.exit(1);
}

const customs = {
  he: "נא לכבד את קדושת המקום והנחיות הגבאים. הקוויטל מונח בפתח המיועד לכך בלבד.",
  en: "Please respect the sanctity of the site and the caretakers' guidance. Kvittels are placed only in the designated opening.",
  fr: "Merci de respecter la sainteté du lieu et les consignes des responsables. Les kvitlekh sont déposés uniquement dans l'ouverture prévue.",
  ru: "Пожалуйста, уважайте святость места и указания смотрителей. Квитлах опускаются только в предназначенное отверстие.",
};

const radomsk: SeedGrave = {
  slug: "radomsk",
  status: "coming_soon",
  country: "PL",
  cityKey: "radomsko",
  timezone: "Europe/Warsaw",
  dynasty: "poland",
  era: [1803, 1866],
  featured: true,
  hilula: { day: 0, month: 0 }, // unknown — not stored (see below)
  sort: 5,
  aliases: ["ראדומסק", "רדומסק", "רדומסקא", "תפארת שלמה", "רבי שלמה הכהן מראדומסק", "Radomsk", "Radomsko", "Tiferes Shlomo", "Tiferet Shlomo", "Rabbi Shlomo of Radomsk", "Радомск", "Радомско"],
  tr: {
    he: { name: "רבי שלמה הכהן מראדומסק", epithet: "בעל ״תפארת שלמה״, מייסד שושלת ראדומסק", place: "ראדומסקו, פולין", bio: "מייסד חסידות ראדומסק (תקס״ג–תרכ״ו לערך) ומחבר הספר ״תפארת שלמה״. ציונו בראדומסקו שבפולין.", customs: customs.he },
    en: { name: "Rabbi Shlomo HaKohen of Radomsk", epithet: "Author of Tiferes Shlomo, founder of the Radomsk dynasty", place: "Radomsko, Poland", bio: "Founder of the Radomsk Chassidic dynasty (c. 1803–1866) and author of Tiferes Shlomo. His resting place is in Radomsko, Poland.", customs: customs.en },
    fr: { name: "Rabbi Chlomo HaCohen de Radomsk", epithet: "Auteur du Tiferet Chlomo, fondateur de la dynastie de Radomsk", place: "Radomsko, Pologne", bio: "Fondateur de la dynastie hassidique de Radomsk (vers 1803–1866) et auteur du Tiferet Chlomo. Sa tombe se trouve à Radomsko, en Pologne.", customs: customs.fr },
    ru: { name: "Рабби Шломо ха-Коэн из Радомска", epithet: "Автор «Тиферет Шломо», основатель династии Радомск", place: "Радомско, Польша", bio: "Основатель хасидской династии Радомск (ок. 1803–1866) и автор книги «Тиферет Шломо». Его могила находится в Радомско, Польша.", customs: customs.ru },
  },
};

const wanted = ["kerestir", "lizhensk", "berditchev", "uman"];
const graves: SeedGrave[] = [...wanted.map((slug) => SEED_GRAVES.find((g) => g.slug === slug)!), radomsk].map((g) => ({ ...g, status: "coming_soon" as const }));

const h = await createDb();
const db = h.db;
const { eq } = await import("drizzle-orm");
let created = 0;
for (const g of graves) {
  const [exists] = await db.select({ id: s.graves.id }).from(s.graves).where(eq(s.graves.slug, g.slug));
  if (exists) {
    console.log(`  = ${g.slug} (already exists, untouched)`);
    continue;
  }
  await db.transaction(async (tx) => {
    const [loc] = await tx.insert(s.locations).values({ countryCode: g.country, cityKey: g.cityKey, verified: false, verificationSource: null }).returning();
    const [row] = await tx
      .insert(s.graves)
      .values({ slug: g.slug, status: "coming_soon", locationId: loc!.id, timezone: g.timezone, dynasty: g.dynasty, eraStartYear: g.era[0], eraEndYear: g.era[1], featured: g.featured, sortOrder: g.sort, permitStatus: "none", isDemo: false, publishedAt: new Date() })
      .returning();
    for (const [locale, t] of Object.entries(g.tr)) {
      await tx.insert(s.graveTranslations).values({ graveId: row!.id, locale, name: t.name, epithet: t.epithet, placeName: t.place, bio: t.bio, customs: t.customs, metaTitle: t.name, metaDescription: t.bio.slice(0, 155), reviewed: false });
    }
    const aliasSet = new Set([...g.aliases, ...Object.values(g.tr).map((t) => t.name)]);
    await tx.insert(s.graveAliases).values([...aliasSet].map((a) => ({ graveId: row!.id, alias: a, script: scriptOf(a), normalized: normalizeSearch(a) })));
    if (g.hilula.day > 0) await tx.insert(s.graveHilulot).values({ graveId: row!.id, hebrewDay: g.hilula.day, hebrewMonth: g.hilula.month, hebrewYearOfPassing: g.hilula.year ?? null, sourceNote: "Commonly cited date — verify before publication", verified: false });
  });
  created++;
  console.log(`  + ${g.slug}`);
}
console.log(`✓ ${created} created, ${graves.length - created} already present. All are coming_soon (not sellable) until an admin activates them.`);
await h.close();
