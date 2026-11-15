# UX & design system — KVITALE / קוויטלה

## Principles
1. **Emotion, photograph, kvittel, user.** The tzaddik's real photograph is the centre of the public site; technology (printers, sensors) is invisible.
2. **Light and calm.** Cream/parchment surfaces carry tasks; deep navy and antique gold mark impressions and actions (hero, CTA, price card, footer).
3. **Honest imagery.** Only rights-verified photographs (Admin → Graves → Media). With no photo, a brand surface with the Hebrew name is shown — never an invented picture.
4. **Truthful states.** Nothing simulated is shown as real; DEMO exists only in an explicit local environment.
5. **No prices before the kvittel is written.** The first price appears on the summary/payment screen.

## Brand assets
Logo: `apps/web/public/brand/kvitale-logo-*.webp` (from the supplied artwork, never redrawn), favicon `src/app/icon.png`, `apple-icon.png`. `LogoMark` = symbol alone, `Logo` = symbol + typeset wordmark (קוויטלה / KVITALE).

## Tokens (`src/app/globals.css`)
Derived from the logo: navy `midnight-*` (wordmark ink), cream `ivory-*`/`parchment` (the note), antique gold `gold-*` (frame, ribbon), blue-grey `line-ink` (handwriting lines). Token names are unchanged so the admin follows automatically.

## Typography
Display: David Libre (Hebrew) / Playfair Display (Latin, Cyrillic). Text and every input: Assistant (Hebrew) / Source Sans 3 (Latin, Cyrillic). Stacks swap by `<html lang>`. Inputs never use a decorative face. Print preview and printer share Noto Serif (packages/print-layout).

## Public journey
`/` (hero + search, selected tziyunim, 3 words, one CTA) → `/graves` (search + country) → `/graves/[slug]` (writing screen over the tziyun photo; "more about" below) → `/checkout` (what is sent, final price, pay) → `/order/[ref]`.
`/write` and `/cart` redirect for old links. Draft + basket live in `src/lib/store.ts` (session storage, optional 7-day device memory, wipe) and survive language switch, other tzaddik, and a cancelled payment.

## The note ("simple" template)
Title "קוויטל" (language follows what is typed), fine ruled lines, names and request on the lines; length follows the text. Implemented once in `packages/print-layout` (preview == printer). Legacy templates remain only so existing orders re-render identically.

## Mobile
Writing first (name + first field on the first screen); preview opens from a bottom bar and never covers the fields; no horizontal scroll at 375/390/768/1440.
