/**
 * DEMO fixtures. Every grave here is flagged is_demo and carries no photos and
 * no coordinates: locations and dates must be verified against trusted sources
 * before any record is presented as fact. Bios are short neutral placeholders.
 */
type L = "he" | "en" | "fr" | "ru";
type Tr = { name: string; epithet: string; place: string; bio: string; customs?: string };

export interface SeedGrave {
  slug: string;
  status: "discovery_only" | "coming_soon" | "active" | "paused" | "maintenance";
  country: string;
  cityKey: string;
  timezone: string;
  dynasty: string;
  era: [number, number | null];
  featured: boolean;
  hilula: { day: number; month: number; year?: number };
  israelHolidays?: boolean;
  aliases: string[];
  tr: Record<L, Tr>;
  sort: number;
}

const customs: Record<L, string> = {
  he: "נא לכבד את קדושת המקום והנחיות הגבאים. הקוויטל מונח בפתח המיועד לכך בלבד.",
  en: "Please respect the sanctity of the site and the caretakers' guidance. Kvittels are placed only in the designated opening.",
  fr: "Merci de respecter la sainteté du lieu et les consignes des responsables. Les kvitlekh sont déposés uniquement dans l'ouverture prévue.",
  ru: "Пожалуйста, уважайте святость места и указания смотрителей. Квитлах опускаются только в предназначенное отверстие.",
};

export const SEED_GRAVES: SeedGrave[] = [
  {
    slug: "kerestir",
    status: "active",
    country: "HU",
    cityKey: "bodrogkeresztur",
    timezone: "Europe/Budapest",
    dynasty: "hungary",
    era: [1851, 1925],
    featured: true,
    hilula: { day: 3, month: 2, year: 5685 },
    sort: 1,
    aliases: ["קרעסטיר", "קערעסטיר", "ר' ישעיה'לה", "רבי שייעלה", "Kerestir", "Keresztur", "Reb Shayale", "Reb Shayele", "Kerestirer Rebbe", "Керестир", "Реб Шаяле"],
    tr: {
      he: { name: "רבי ישעיה מקרעסטיר", epithet: "ר׳ ישעיה׳לה, בעל הכנסת האורחים", place: "קרעסטיר (בודרוגקרסטור), הונגריה", bio: "צדיק הונגרי (תרי״א–תרפ״ה) שנודע באהבת ישראל ובהכנסת אורחים. רבים פוקדים את ציונו, ובמיוחד ביום ההילולא, ג׳ באייר.", customs: customs.he },
      en: { name: "Rabbi Yeshaya of Kerestir", epithet: "Reb Shayale, renowned for his hospitality", place: "Bodrogkeresztúr, Hungary", bio: "A Hungarian tzaddik (1851–1925) remembered for his love of every Jew and his open home. Many visit his resting place, especially on his hilula, 3 Iyar.", customs: customs.en },
      fr: { name: "Rabbi Ichaya de Kerestir", epithet: "Reb Chayélé, célèbre pour son hospitalité", place: "Bodrogkeresztúr, Hongrie", bio: "Tsaddik hongrois (1851–1925), connu pour son amour de chaque Juif et sa maison ouverte. Beaucoup se recueillent sur sa tombe, surtout le jour de sa hilloula, le 3 Iyar.", customs: customs.fr },
      ru: { name: "Рабби Йешая из Керестира", epithet: "Реб Шаяле, известный своим гостеприимством", place: "Бодрогкерестур, Венгрия", bio: "Венгерский праведник (1851–1925), известный любовью к каждому еврею и открытым домом. Многие приезжают к его могиле, особенно в день хилулы, 3 ияра.", customs: customs.ru },
    },
  },
  {
    slug: "lizhensk",
    status: "active",
    country: "PL",
    cityKey: "lezajsk",
    timezone: "Europe/Warsaw",
    dynasty: "poland",
    era: [1717, 1787],
    featured: true,
    hilula: { day: 21, month: 12, year: 5547 },
    sort: 2,
    aliases: ["ליז'נסק", "ליזענסק", "ליזשענסק", "נועם אלימלך", "הרבי ר' אלימלך", "Lizhensk", "Lizensk", "Lezajsk", "Leżajsk", "Noam Elimelech", "Rebbe Reb Elimelech", "Лиженск", "Лежайск", "Ноам Элимелех"],
    tr: {
      he: { name: "רבי אלימלך מליז׳נסק", epithet: "בעל ״נועם אלימלך״", place: "ליז׳נסק, פולין", bio: "מגדולי מורי החסידות בפולין (תע״ז–תקמ״ז), תלמיד המגיד ממזריטש ומחבר הספר ״נועם אלימלך״. יום ההילולא חל בכ״א באדר.", customs: customs.he },
      en: { name: "Rabbi Elimelech of Lizhensk", epithet: "Author of Noam Elimelech", place: "Leżajsk, Poland", bio: "One of the great teachers of Polish Chassidism (1717–1787), disciple of the Maggid of Mezritch and author of Noam Elimelech. His hilula falls on 21 Adar.", customs: customs.en },
      fr: { name: "Rabbi Élimélekh de Lizensk", epithet: "Auteur du Noam Élimélekh", place: "Leżajsk, Pologne", bio: "L'un des grands maîtres du hassidisme polonais (1717–1787), disciple du Maguid de Mezritch et auteur du Noam Élimélekh. Sa hilloula tombe le 21 Adar.", customs: customs.fr },
      ru: { name: "Рабби Элимелех из Лиженска", epithet: "Автор «Ноам Элимелех»", place: "Лежайск, Польша", bio: "Один из великих учителей польского хасидизма (1717–1787), ученик Магида из Межерича и автор книги «Ноам Элимелех». Хилула — 21 адара.", customs: customs.ru },
    },
  },
  {
    slug: "berditchev",
    status: "maintenance",
    country: "UA",
    cityKey: "berdychiv",
    timezone: "Europe/Kyiv",
    dynasty: "ukraine",
    era: [1740, 1809],
    featured: false,
    hilula: { day: 25, month: 7, year: 5570 },
    sort: 5,
    aliases: ["ברדיטשוב", "בארדיטשוב", "קדושת לוי", "Berditchev", "Berdichev", "Berdychiv", "Kedushat Levi", "Kedushas Levi", "Бердичев", "Кдушат Леви"],
    tr: {
      he: { name: "רבי לוי יצחק מברדיטשוב", epithet: "בעל ״קדושת לוי״, סנגורם של ישראל", place: "ברדיטשוב, אוקראינה", bio: "מגדולי החסידות (ת״ק–תק״ע), שנודע כמליץ יושר על עם ישראל ומחבר ״קדושת לוי״. יום ההילולא חל בכ״ה בתשרי.", customs: customs.he },
      en: { name: "Rabbi Levi Yitzchak of Berditchev", epithet: "Author of Kedushat Levi, defender of Israel", place: "Berdychiv, Ukraine", bio: "A towering Chassidic master (1740–1809), remembered as the advocate of the Jewish people and author of Kedushat Levi. His hilula falls on 25 Tishrei.", customs: customs.en },
      fr: { name: "Rabbi Lévi Its'hak de Berditchev", epithet: "Auteur du Kedouchat Lévi, défenseur d'Israël", place: "Berdytchiv, Ukraine", bio: "Grand maître hassidique (1740–1809), connu comme l'avocat du peuple juif et auteur du Kedouchat Lévi. Sa hilloula tombe le 25 Tichri.", customs: customs.fr },
      ru: { name: "Рабби Леви-Ицхак из Бердичева", epithet: "Автор «Кдушат Леви», заступник Израиля", place: "Бердичев, Украина", bio: "Великий хасидский учитель (1740–1809), известный как заступник еврейского народа и автор книги «Кдушат Леви». Хилула — 25 тишрея.", customs: customs.ru },
    },
  },
  {
    slug: "uman",
    status: "coming_soon",
    country: "UA",
    cityKey: "uman",
    timezone: "Europe/Kyiv",
    dynasty: "breslov",
    era: [1772, 1810],
    featured: true,
    hilula: { day: 18, month: 7, year: 5571 },
    sort: 3,
    aliases: ["אומן", "ברסלב", "רבי נחמן", "מוהר\"ן", "Uman", "Breslov", "Breslev", "Rebbe Nachman", "Rabbi Nachman", "Умань", "Брацлав", "Рабби Нахман"],
    tr: {
      he: { name: "רבי נחמן מברסלב", epithet: "מוהר״ן, בעל ״ליקוטי מוהר״ן״", place: "אומן, אוקראינה", bio: "נינו של הבעל שם טוב (תקל״ב–תקע״א) ומחבר ״ליקוטי מוהר״ן״. ציונו באומן הוא מוקד עלייה לרגל, ובמיוחד בראש השנה.", customs: customs.he },
      en: { name: "Rebbe Nachman of Breslov", epithet: "Author of Likutei Moharan", place: "Uman, Ukraine", bio: "Great-grandson of the Baal Shem Tov (1772–1810) and author of Likutei Moharan. His resting place in Uman draws pilgrims year-round, above all on Rosh Hashanah.", customs: customs.en },
      fr: { name: "Rabbi Nahman de Breslev", epithet: "Auteur du Likouté Moharan", place: "Ouman, Ukraine", bio: "Arrière-petit-fils du Baal Chem Tov (1772–1810) et auteur du Likouté Moharan. Sa tombe à Ouman attire des pèlerins toute l'année, surtout à Roch Hachana.", customs: customs.fr },
      ru: { name: "Рабби Нахман из Брацлава", epithet: "Автор «Ликутей Моаран»", place: "Умань, Украина", bio: "Правнук Бааль Шем Това (1772–1810) и автор «Ликутей Моаран». Его могила в Умани привлекает паломников круглый год, особенно на Рош а-Шана.", customs: customs.ru },
    },
  },
  {
    slug: "medzhybizh",
    status: "coming_soon",
    country: "UA",
    cityKey: "medzhybizh",
    timezone: "Europe/Kyiv",
    dynasty: "ukraine",
    era: [1698, 1760],
    featured: false,
    hilula: { day: 6, month: 3, year: 5520 },
    sort: 4,
    aliases: ["הבעל שם טוב", "הבעש\"ט", "מעזיבוז", "מז'יבוז'", "Baal Shem Tov", "Besht", "Medzhybizh", "Mezhbizh", "Medzhibozh", "Бааль Шем Тов", "Меджибож"],
    tr: {
      he: { name: "רבי ישראל בעל שם טוב", epithet: "הבעש״ט, מייסד תנועת החסידות", place: "מז׳יבוז׳, אוקראינה", bio: "מייסד תנועת החסידות (תנ״ח–תק״כ), שלימד על עבודת ה׳ בשמחה ועל אהבת כל יהודי. נסתלק בחג השבועות, ו׳ בסיוון.", customs: customs.he },
      en: { name: "Rabbi Israel Baal Shem Tov", epithet: "The Besht, founder of Chassidism", place: "Medzhybizh, Ukraine", bio: "Founder of the Chassidic movement (1698–1760), who taught serving G-d with joy and love for every Jew. He passed away on Shavuot, 6 Sivan.", customs: customs.en },
      fr: { name: "Rabbi Israël Baal Chem Tov", epithet: "Le Becht, fondateur du hassidisme", place: "Medjybij, Ukraine", bio: "Fondateur du mouvement hassidique (1698–1760), il enseigna le service divin dans la joie et l'amour de chaque Juif. Il quitta ce monde à Chavouot, le 6 Sivan.", customs: customs.fr },
      ru: { name: "Рабби Исраэль Бааль Шем Тов", epithet: "Бешт, основатель хасидизма", place: "Меджибож, Украина", bio: "Основатель хасидского движения (1698–1760), учивший служить Всевышнему в радости и любить каждого еврея. Ушёл из мира в Шавуот, 6 сивана.", customs: customs.ru },
    },
  },
  {
    slug: "lublin",
    status: "paused",
    country: "PL",
    cityKey: "lublin",
    timezone: "Europe/Warsaw",
    dynasty: "poland",
    era: [1745, 1815],
    featured: false,
    hilula: { day: 9, month: 5, year: 5575 },
    sort: 6,
    aliases: ["החוזה מלובלין", "לובלין", "Chozeh of Lublin", "Seer of Lublin", "Hozeh", "Lublin", "Провидец из Люблина", "Люблин", "Voyant de Lublin"],
    tr: {
      he: { name: "החוזה מלובלין", epithet: "רבי יעקב יצחק הורוביץ", place: "לובלין, פולין", bio: "מגדולי מנהיגי החסידות בפולין (תק״ה–תקע״ה), תלמיד רבי אלימלך מליז׳נסק. יום ההילולא חל בתשעה באב.", customs: customs.he },
      en: { name: "The Chozeh of Lublin", epithet: "Rabbi Yaakov Yitzchak Horowitz", place: "Lublin, Poland", bio: "A leading Chassidic master of Poland (1745–1815) and disciple of Rabbi Elimelech of Lizhensk. His hilula falls on Tisha B'Av.", customs: customs.en },
      fr: { name: "Le Voyant de Lublin", epithet: "Rabbi Yaakov Its'hak Horowitz", place: "Lublin, Pologne", bio: "Grand maître hassidique de Pologne (1745–1815), disciple de Rabbi Élimélekh de Lizensk. Sa hilloula tombe le 9 Av.", customs: customs.fr },
      ru: { name: "Провидец из Люблина", epithet: "Рабби Яаков-Ицхак Горовиц", place: "Люблин, Польша", bio: "Один из великих хасидских лидеров Польши (1745–1815), ученик рабби Элимелеха из Лиженска. Хилула — 9 ава.", customs: customs.ru },
    },
  },
  {
    slug: "meron",
    status: "discovery_only",
    country: "IL",
    cityKey: "meron",
    timezone: "Asia/Jerusalem",
    dynasty: "tannaim",
    era: [100, null],
    featured: false,
    hilula: { day: 18, month: 2 },
    israelHolidays: true,
    sort: 7,
    aliases: ["רבי שמעון בר יוחאי", "רשב\"י", "מירון", "Rabbi Shimon bar Yochai", "Rashbi", "Meron", "Рабби Шимон бар Йохай", "Рашби", "Мерон", "Rabbi Chimon bar Yohaï"],
    tr: {
      he: { name: "רבי שמעון בר יוחאי", epithet: "הרשב״י", place: "מירון, ישראל", bio: "התנא רבי שמעון בר יוחאי, תלמיד רבי עקיבא. יום ההילולא חל בל״ג בעומר, י״ח באייר. רשומה זו לעיון בלבד — אין שירות הדפסה במקום.", customs: customs.he },
      en: { name: "Rabbi Shimon bar Yochai", epithet: "The Rashbi", place: "Meron, Israel", bio: "The Tanna Rabbi Shimon bar Yochai, disciple of Rabbi Akiva. His hilula is Lag BaOmer, 18 Iyar. This listing is for discovery only — no printing service on site.", customs: customs.en },
      fr: { name: "Rabbi Chimon bar Yo'haï", epithet: "Le Rachbi", place: "Méron, Israël", bio: "Le Tana Rabbi Chimon bar Yo'haï, disciple de Rabbi Akiva. Sa hilloula est Lag Baomer, le 18 Iyar. Fiche informative uniquement — pas de service d'impression sur place.", customs: customs.fr },
      ru: { name: "Рабби Шимон бар Йохай", epithet: "Рашби", place: "Мерон, Израиль", bio: "Танна рабби Шимон бар Йохай, ученик рабби Акивы. Хилула — Лаг ба-Омер, 18 ияра. Только справочная страница — печать на месте недоступна.", customs: customs.ru },
    },
  },
  {
    slug: "tiberias-rabbi-meir",
    status: "discovery_only",
    country: "IL",
    cityKey: "tiberias",
    timezone: "Asia/Jerusalem",
    dynasty: "tannaim",
    era: [100, null],
    featured: false,
    hilula: { day: 14, month: 2 },
    israelHolidays: true,
    sort: 8,
    aliases: ["רבי מאיר בעל הנס", "טבריה", "Rabbi Meir Baal HaNes", "Rabbi Meir Baal Haness", "Tiberias", "Рабби Меир Бааль а-Нес", "Тверия", "Rabbi Meïr Baal HaNess"],
    tr: {
      he: { name: "רבי מאיר בעל הנס", epithet: "התנא רבי מאיר", place: "טבריה, ישראל", bio: "התנא רבי מאיר, מגדולי תלמידי רבי עקיבא. יום ההילולא המקובל חל בפסח שני, י״ד באייר. רשומה זו לעיון בלבד.", customs: customs.he },
      en: { name: "Rabbi Meir Baal HaNes", epithet: "The Tanna Rabbi Meir", place: "Tiberias, Israel", bio: "The Tanna Rabbi Meir, among the foremost disciples of Rabbi Akiva. His customary hilula is Pesach Sheni, 14 Iyar. Discovery listing only.", customs: customs.en },
      fr: { name: "Rabbi Meïr Baal HaNess", epithet: "Le Tana Rabbi Meïr", place: "Tibériade, Israël", bio: "Le Tana Rabbi Meïr, l'un des plus grands disciples de Rabbi Akiva. Sa hilloula usuelle est Pessa'h Chéni, le 14 Iyar. Fiche informative uniquement.", customs: customs.fr },
      ru: { name: "Рабби Меир Бааль а-Нес", epithet: "Танна рабби Меир", place: "Тверия, Израиль", bio: "Танна рабби Меир, один из величайших учеников рабби Акивы. Принятая дата хилулы — Песах шени, 14 ияра. Только справочная страница.", customs: customs.ru },
    },
  },
];

export const DEMO_USERS = [
  { email: "admin@demo.kvittel.local", name: "Demo Super Admin", role: "super_admin" },
  { email: "finance@demo.kvittel.local", name: "Demo Finance", role: "finance" },
  { email: "support@demo.kvittel.local", name: "Demo Support", role: "support_limited" },
  { email: "content@demo.kvittel.local", name: "Demo Content Editor", role: "content_editor" },
  { email: "partner@demo.kvittel.local", name: "Demo Partner Manager", role: "partner_manager", partner: "kerestir" },
  { email: "maintainer@demo.kvittel.local", name: "Demo Local Maintainer", role: "local_maintainer", partner: "kerestir" },
  { email: "customer@demo.kvittel.local", name: "Demo Customer", role: "customer" },
] as const;

export const FEATURE_FLAGS: Array<[string, boolean, string]> = [
  ["demo_mode", true, "Show DEMO banners, mock payment provider and device lab"],
  ["multi_grave_orders", true, "Send one kvittel to several graves in one order"],
  ["saved_names_cloud", true, "Signed-in users may save names lists (explicit consent)"],
  ["handwriting_upload", true, "Upload a photo of a handwritten kvittel (JPG/PNG)"],
  ["video_proof", false, "Private delivery clip (requires camera hardware + privacy review)"],
  ["scheduled_deliveries", false, "Schedule sends for a future date / hilula"],
  ["hilula_reminders", false, "Email reminders before hilulot"],
  ["whatsapp_notifications", false, "WhatsApp channel — requires approved business integration"],
  ["ai_writing_assistant", false, "Optional AI phrasing helper — never sees requests without consent"],
  ["partner_settlements", false, "Partner revenue share settlements"],
  ["ota_manager", false, "Signed OTA release manager for device agents"],
];

export const PRICE_DEFAULTS: Record<string, { kvittel: number; extra_page: number }> = {
  USD: { kvittel: 1800, extra_page: 500 },
  EUR: { kvittel: 1700, extra_page: 450 },
  ILS: { kvittel: 6500, extra_page: 1800 },
  GBP: { kvittel: 1500, extra_page: 400 },
  CAD: { kvittel: 2400, extra_page: 650 },
  AUD: { kvittel: 2700, extra_page: 750 },
};
