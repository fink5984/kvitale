import { getTranslations, setRequestLocale } from "next-intl/server";
import { Kpi } from "@/components/admin/kit";
import { LogoMark } from "@/components/brand/Logo";
import { DesignPlayground } from "@/components/design/DesignPlayground";
import { GravePortrait } from "@/components/graves/GraveCard";
import { HeroArt } from "@/components/home/HeroArt";
import { ArchGlyph, Badge, Button, DemoBadge, EmptyState, Field, Input, Notice, Ornament, Skeleton, Stepper, buttonClass } from "@/components/ui";

export const metadata = { title: "Design system", robots: { index: false } };

const SWATCHES: Array<[string, string]> = [
  ["midnight-950", "#070d18"], ["midnight-900", "#0b1424"], ["midnight-700", "#1d3152"], ["midnight-400", "#6b7fa3"],
  ["ivory-50", "#fdfbf6"], ["ivory-100", "#f8f3e8"], ["stone-100", "#ece3d0"], ["stone-300", "#d2c3a3"],
  ["gold-200", "#ecd8a6"], ["gold-400", "#cfaa63"], ["gold-500", "#b38d48"], ["gold-700", "#6c5226"],
  ["charcoal-700", "#3b3731"], ["charcoal-500", "#6a6359"], ["umber-600", "#5c4631"], ["parchment", "#efe4cc"],
  ["sage-600", "#3f5d45"], ["ochre-600", "#9a6a1e"], ["oxblood-600", "#8a2c26"], ["ink-600", "#2c4a73"],
];

const SPECIMENS: Array<{ lang: string; dir: "rtl" | "ltr"; label: string; display: string; body: string }> = [
  { lang: "he", dir: "rtl", label: "עברית · Frank Ruhl Libre / Heebo", display: "רבי ישעיה מקרעסטיר", body: "יוסף חיים בֶּן שָׂרָה — לרפואה שלמה ולהצלחה בכל העניינים." },
  { lang: "yi", dir: "rtl", label: "ייִדיש · Frank Ruhl Libre / Heebo", display: "אַ בקשה בײַם ציון", body: "פֿאַר געזונט און פּרנסה, מיט דאַנקבאַרקייט פֿאַר אַלעם גוטן." },
  { lang: "en", dir: "ltr", label: "English · Cormorant Garamond / Manrope", display: "Your kvittel, placed at the tziyun.", body: "Printed on site, cut, and confirmed by the chute sensor." },
  { lang: "fr", dir: "ltr", label: "Français · Cormorant Garamond / Manrope", display: "Votre kvitel, déposé au tsiyoun.", body: "Élodie-Joséphine bat Béatrice — « pour la réussite » ; œuvre, ça, où." },
  { lang: "ru", dir: "ltr", label: "Русский · Cormorant Garamond / Manrope", display: "Ваш квитл — у могилы праведника.", body: "Александр бен Светлана — о здоровье и мире в нашем доме. Ёлка, щедрость." },
];

export default async function DesignPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("design");
  return (
    <div className="pb-28">
      <section className="tex-stone border-b border-stone-300/60">
        <div className="mx-auto max-w-[88rem] px-[var(--gutter)] py-16 sm:py-24">
          <p className="eyebrow text-gold-700">{t("eyebrow")}</p>
          <h1 className="font-display mt-4 text-[clamp(2.6rem,6vw,5rem)] leading-[1] text-midnight-900">{t("title")}</h1>
          <p className="mt-5 max-w-2xl text-lg text-charcoal-600">{t("intro")}</p>
        </div>
      </section>

      <div className="mx-auto max-w-[88rem] space-y-24 px-[var(--gutter)] pt-16">
        {/* Art directions */}
        <section aria-labelledby="ad">
          <h2 id="ad" className="font-display text-4xl text-midnight-900">{t("directions.title")}</h2>
          <p className="mt-3 max-w-3xl text-charcoal-600">{t("directions.body")}</p>
          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <figure className="overflow-hidden rounded-xl ring-1 ring-stone-300">
              <div className="tex-night relative grid aspect-[16/10] grid-cols-[1fr_0.8fr] items-center gap-4 p-8 text-ivory-50">
                <div>
                  <p className="eyebrow text-gold-300">A · Nocturne</p>
                  <p className="font-display mt-3 text-4xl leading-none">{t("directions.a.sample")}</p>
                  <span className={buttonClass("gold", "sm", "mt-6")}>{t("directions.cta")}</span>
                </div>
                <HeroArt className="h-full max-h-64" />
              </div>
              <figcaption className="bg-ivory-50 p-5 text-sm leading-relaxed text-charcoal-600"><b className="text-midnight-900">A · Nocturne.</b> {t("directions.a.body")}</figcaption>
            </figure>
            <figure className="overflow-hidden rounded-xl ring-1 ring-stone-300">
              <div className="tex-stone relative grid aspect-[16/10] grid-cols-[1fr_0.7fr] items-center gap-6 p-8">
                <div>
                  <p className="eyebrow text-gold-700">B · Limestone</p>
                  <p className="font-display mt-3 text-4xl leading-none text-midnight-900">{t("directions.b.sample")}</p>
                  <span className={buttonClass("primary", "sm", "mt-6")}>{t("directions.cta")}</span>
                </div>
                <GravePortrait nameHe="רבי אלימלך מליז׳נסק" className="aspect-[4/5] rounded-t-full rounded-b-md ring-1 ring-stone-300" />
              </div>
              <figcaption className="bg-ivory-50 p-5 text-sm leading-relaxed text-charcoal-600"><b className="text-midnight-900">B · Limestone.</b> {t("directions.b.body")}</figcaption>
            </figure>
          </div>
          <Notice tone="gold" className="mt-8" title={t("directions.chosenTitle")}>{t("directions.chosen")}</Notice>
        </section>

        {/* Colour */}
        <section aria-labelledby="color">
          <h2 id="color" className="font-display text-4xl text-midnight-900">{t("color.title")}</h2>
          <p className="mt-3 max-w-3xl text-charcoal-600">{t("color.body")}</p>
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
            {SWATCHES.map(([name, hex]) => (
              <li key={name} className="overflow-hidden rounded-lg ring-1 ring-stone-300">
                <div className="h-20" style={{ background: hex }} />
                <div className="bg-ivory-50 px-3 py-2 text-xs">
                  <p className="font-medium">{name}</p>
                  <p className="font-mono text-charcoal-500">{hex}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Type */}
        <section aria-labelledby="type">
          <h2 id="type" className="font-display text-4xl text-midnight-900">{t("type.title")}</h2>
          <p className="mt-3 max-w-3xl text-charcoal-600">{t("type.body")}</p>
          <div className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {SPECIMENS.map((s) => (
              <div key={s.lang} lang={s.lang} dir={s.dir} className="grid gap-3 py-8 lg:grid-cols-[14rem_1fr]">
                <p className="text-xs uppercase tracking-wider text-charcoal-500">{s.label}</p>
                <div>
                  <p className={`${s.dir === "rtl" ? "hebrew-name" : "font-display"} text-[clamp(2rem,4vw,3.4rem)] leading-[1.05] text-midnight-900`} style={s.dir === "ltr" ? { fontFamily: "var(--font-cormorant), var(--font-frank), serif" } : undefined}>{s.display}</p>
                  <p className="mt-3 text-lg text-charcoal-700" style={{ fontFamily: s.dir === "rtl" ? "var(--font-heebo), sans-serif" : "var(--font-manrope), sans-serif" }}>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Components */}
        <section aria-labelledby="comp" className="space-y-10">
          <h2 id="comp" className="font-display text-4xl text-midnight-900">{t("components.title")}</h2>
          <div className="flex flex-wrap items-center gap-3">
            <Button>Primary</Button>
            <Button variant="gold">Gold</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="quiet">Quiet</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success" dot>available_now</Badge>
            <Badge tone="info">scheduled</Badge>
            <Badge tone="warning">maintenance</Badge>
            <Badge tone="danger">uncertain</Badge>
            <Badge tone="gold">paid</Badge>
            <Badge>discovery_only</Badge>
            <Badge tone="night">night</Badge>
            <DemoBadge />
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Field label="Field" hint="Hint text" htmlFor="ds-1"><Input id="ds-1" placeholder="Placeholder" /></Field>
            <Field label="Invalid" error="Error message" htmlFor="ds-2"><Input id="ds-2" aria-invalid defaultValue="bad@" /></Field>
            <DesignPlayground />
          </div>
          <Stepper steps={["Tziyun", "Write", "Review", "Payment", "Delivery"]} current={2} label="Stepper" />
          <div className="grid gap-6 md:grid-cols-3">
            <Notice tone="info" title="Info">Neutral, factual guidance.</Notice>
            <Notice tone="warning" title="Warning">Blocking issue or scheduled delivery.</Notice>
            <Notice tone="success" title="Success">Confirmed by hardware.</Notice>
          </div>
          <div className="grid gap-6 md:grid-cols-4">
            <Kpi label="KPI" value="1,284" sub="vs previous period" delta={{ pct: 12 }} />
            <Kpi label="KPI (lower is better)" value="2.4%" delta={{ pct: -30, good: "down" }} />
            <div className="space-y-3 rounded-lg border border-[var(--line)] bg-ivory-50 p-5"><Skeleton className="h-6 w-1/2" /><Skeleton className="h-10" /><Skeleton className="h-4 w-2/3" /></div>
            <div className="grid place-items-center gap-3 rounded-lg border border-[var(--line)] bg-ivory-50 p-5"><LogoMark className="h-14 w-12" /><ArchGlyph className="h-10 w-8 text-gold-500" /></div>
          </div>
          <EmptyState title="Empty state" body="Every list has a designed empty state with a next step." action={<Button size="sm" variant="outline">Action</Button>} />
          <Ornament />
        </section>
      </div>
    </div>
  );
}
