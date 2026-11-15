# Localization

- **Live**: he (default, RTL), en, fr, ru. **Gated**: yi (RTL), es, pt, de — catalogs complete but awaiting native QA; enable with `NEXT_PUBLIC_EXTRA_LOCALES=yi,es` after review.
- Routes are always prefixed: `/he/...`. First visit uses `Accept-Language`; manual choice persists in the `NEXT_LOCALE` cookie. Switching language keeps the path, query and the in-progress kvittel (session store).
- Catalogs: `apps/web/messages/<locale>/*.json`, deep-merged per locale (one file per feature: `public.json`, `builder.json`, `admin-core.json`, `admin-fleet.json`, `operator.json`, `lab.json`…). ICU syntax (plurals incl. Russian one/few/many/other). Never write a literal `<word` (parsed as a tag).
- Coverage report: Admin → Settings → Languages (strings identical to English count as untranslated).
- **Content vs UI**: grave texts, legal pages live in the DB per locale with a `reviewed` flag and visible fallback ("shown in another language").
- **Kvittel language is independent of UI language** (`nusach`). Names, the tzaddik's printed name and requests are never transliterated or changed automatically.
- Bidi: `dir` on `<html>`, logical CSS, `<bdi>` around names/refs/amounts, `flip-rtl` on arrows; SVG drawings that must not mirror use `direction="ltr"`.
- Fonts per script: Frank Ruhl Libre + Heebo (Hebrew/Yiddish), Cormorant Garamond + Manrope (Latin/Cyrillic); printing uses Noto Serif Hebrew + Noto Serif. Specimens on `/design`.
- Formatting via `Intl` (money, dates in grave TZ, Hebrew calendar via `u-ca-hebrew` and hebcal).
- QA: `e2e/admin.spec.ts`, `e2e/operator-lab.spec.ts` assert no missing keys, no horizontal overflow and `dir=rtl` in he at 390/1440.

Terms flagged by the translator for native review: ru plural of «квитл»; he «זיווג הגון»; yi terms for "chute"/"unit"; es/pt transliterations of tziyun; de «Grabstätte». See git history of `messages/` for the full notes.
