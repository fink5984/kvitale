# Roadmap

## Next (before a pilot site)
1. **Hardware bring-up** of one candidate printer (see HARDWARE_BOM.md): verify raster, full cut, status bytes, near-end; wire IR break-beam on the chute; record a printer profile with verified capabilities.
2. **Payment provider decision** (entity, countries, currencies) → enable Stripe (or Tranzila/Adyen adapter), test in sandbox, refunds via provider API.
3. **Email provider** (Resend/SES/SMTP) with SPF/DKIM; localized templates already exist.
4. **Legal**: counsel review of terms, privacy, refunds, delivery disclosure in each language; caretakers' written permission template.
5. **Native QA** of he/fr/ru copy; then yi/es/pt/de.
6. **Production infra**: managed Postgres, object storage adapter, separate worker, Sentry/OTel, uptime alerts, backup drill.
7. Lighthouse / Web Vitals measurement on production hosting; fix to ≥ 90.

## Later (flags already reserved)
- `hilula_reminders`, `scheduled_deliveries` (rules: hilula, Rosh Chodesh, date) — schema present.
- `video_proof` — camera clip per job, owner-only signed URLs.
- `partner_settlements` — monthly statements from `partner_agreements`.
- `ota_manager` — signed releases, canary percentages, health-gated rollout (tables `firmware_releases`, `rollouts`).
- `ai_writing_assistant` — optional phrasing help, explicit consent, never sees requests otherwise.
- Bulk/institutional orders with CSV import, partner API with usage limits, gift a kvittel, PWA & push, QR plaques per grave, demand heatmap for site prioritisation.
- Human-delivery service for graves without units — a separate, clearly labelled product.
