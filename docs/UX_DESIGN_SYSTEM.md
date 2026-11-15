# UX & design system — "Nocturne & Limestone"

Live reference: **`/{locale}/design`** (art directions, tokens, type specimens per script, components).

## Principles
1. **Sacred, quiet, precise.** No casino glow, no donation-site urgency, no generic SaaS gradients. Gold is light, never fill.
2. **Night for meaning, limestone for work.** Dark sections mark moments (arrival, delivery proof, footer, admin navigation); light editorial surfaces carry tasks.
3. **Honest imagery.** No stock photos, no fabricated tombstones. Graves are shown as *typographic portraits*: the Hebrew name set inside a limestone arch. Licensed photos appear only with confirmed rights.
4. **Truthful states.** Every status, chart and badge reflects real data or is labelled DEMO.

## Tokens (`apps/web/src/app/globals.css`)
- Palette: midnight 950–300, ivory 50–200, stone 100–500, gold 100–700, charcoal 400–900, umber, parchment; status sage/ochre/oxblood/ink.
- Radii 2/4/8/14/22 + arch (`rounded-t-full rounded-b-*`). Shadows: hair, soft, lift, paper, glow (warm, never grey).
- Motion: `rise` reveal, `flicker` candle, `kvittel-descend` hero, `paper-feed`; all disabled under `prefers-reduced-motion`.
- Textures: `tex-stone`, `tex-night`, `tex-paper` — inline SVG noise, licence-free.

## Typography
Display: Frank Ruhl Libre (he/yi) / Cormorant Garamond (Latin, Cyrillic). Body: Heebo / Manrope. Font stacks swap by `<html lang>`, and Hebrew names inside Latin pages keep a Hebrew face. Eyebrows use tracked caps in Latin and gentle spacing in Hebrew.

## Signature interactions
- **Hero**: night arch with a kvittel descending into the opening; live search combobox (ARIA, keyboard).
- **Builder**: form left, *stone niche stage* right with the exact printed slip (same engine/fonts as the printer), "show as printed" 1-bit toggle, torn-paper edges; mobile bottom bar + preview sheet.
- **Tracking**: horizontal/vertical timeline with times in the grave's local time and an explicit confidence statement.
- **Device Lab**: a "printer mouth" where simulated slips feed out.

## Components (`@/components/ui`, `@/components/admin/kit`)
Button (primary, gold, outline, ghost, quiet, danger, onDark; sizes; loading), Field/Input/Textarea/Select, Checkbox, Segmented, Card, Badge, DemoBadge, Notice, Stepper, Modal, Drawer, Skeleton, Spinner, EmptyState, ErrorState, Ornament, ArchGlyph; admin: PageHeader, Panel, Kpi (with deltas, drill-down), Table/Td, BarChart, LineChart, Meter, Dl.

## Accessibility (WCAG 2.2 AA target)
Skip link; visible gold focus ring; landmarks and labelled regions; Radix dialogs (focus trap, Esc); combobox semantics; `aria-live` for search counts, warnings and statuses; reduced-motion; contrast-checked text pairs; `lang` on mixed-script fragments. Not yet done: full screen-reader audit and automated axe run in CI.

## Responsive
Mobile-first; verified at 390 and 1440 by Playwright (no horizontal overflow) for public, admin and operator; desktop layouts are composed, not stretched (max width 88rem, asymmetric grids, sticky stages).
