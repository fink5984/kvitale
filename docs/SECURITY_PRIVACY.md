# Security & privacy

Kvittlach can reveal health, faith and family matters. Privacy is a design constraint, not a feature. **Publishing these documents or policy texts does not by itself make the service legally compliant** — GDPR/Israeli Privacy Protection Law/other regimes require review by counsel per operating jurisdiction.

## Data classification
| Class | Examples | Handling |
|---|---|---|
| Sacred / sensitive | names, requests, handwriting images, saved name lists | AES-256-GCM (`seal`) at rest; decrypted only in memory for render; purged N days after delivery; never logged/exported/emailed; admin view = break-glass with reason + audit |
| Personal | email, locale, consents | access-controlled; exportable; anonymisable |
| Operational | order refs, statuses, device telemetry | normal access control |
| Secrets | session tokens, device tokens, webhook/command keys | only SHA-256 hashes stored; secrets in env |

## Controls implemented
- **AuthN**: magic link (15 min, single use) + 6-digit OTP (5 attempts), httpOnly SameSite=Lax session cookie (Secure in prod), sessions revocable.
- **AuthZ**: RBAC (`src/server/rbac.ts`) checked server-side in every page (`guardPage`) and action (`requirePermission`); partner roles scoped by grave (`assertGraveScope`). Four-eyes refund approval. Only `super_admin` holds `kvittel.content.read`.
- **Payments**: amounts computed server-side; webhook HMAC with 5-min tolerance, `timingSafeEqual`; idempotency via unique `(provider, event_id)`; amount/currency must match the stored payment; no card data ever touches our servers.
- **Devices**: bearer tokens (hashed), revocation, rotation with 10-min grace, pairing codes single-use 30 min, commands HMAC-signed per device and limited to a closed set (no shell), outbound-only connectivity, rate limits.
- **Uploads**: type sniffing (magic bytes), 8 MB cap, decode + re-encode (metadata/polyglot payloads dropped), encrypted storage, origin check.
- **Web**: CSRF protected by Next server actions' origin checks + SameSite cookies; security headers (HSTS, nosniff, frame DENY, referrer policy, permissions policy); React escaping; CSV formula-injection neutralised; parameterised SQL via Drizzle; Zod validation on all inputs; honeypot + rate limits on checkout/auth/search/uploads/requests.
- **Logging**: JSON logger redacts content/name/token/email keys at any depth; audit log stores identifiers and reasons only.
- **Tracking links**: random 24-byte tokens, hashed, 120-day expiry; buyer's browser keeps one in an httpOnly cookie, the email carries a different one.

## Tested (apps/web/test, e2e)
Webhook replay/tamper/stale, amount spoofing, duplicate device events, no double print, lease expiry semantics, invalid/forged device tokens, role access (support vs finance/settings), partner scope (operator cannot open other graves), guest cannot open someone else's order without token, sensitive-log redaction, input validation.

## Gaps / next steps
- CAPTCHA after risk signals (interface: rate-limit hooks) — not integrated.
- Malware scanning of uploads (re-encoding mitigates, does not replace AV) — not integrated.
- Key management: move encryption keys to a KMS with rotation (envelope supports versioned prefix `v1.`).
- Shared rate-limit store when running >1 instance.
- Pen-test before launch; DPIA; records of processing; DPA with payment/email providers.

## Camera add-on (future) — privacy design
Camera framed only on the slot exit (no people), short clip per job triggered by the job, encrypted object storage, signed URLs to the order owner only, retention ≤ 14 days, opt-in at checkout, physical notice at the site. Not offered anywhere it is not installed and approved.

## Incident response (summary)
Contain (revoke tokens/keys, pause devices), assess scope via audit log, notify DPO/counsel, notify affected users/regulators within statutory deadlines, post-mortem. See OPERATIONS.md for runbooks.
