import "server-only";

function demoModeAllowed(): boolean {
  if (process.env.KVITTEL_DEMO_MODE !== "1") return false;
  if (process.env.DATABASE_URL || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) return false;
  return true;
}

export const env = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  isProd: process.env.NODE_ENV === "production",
  /**
   * DEMO mode (mock payments, dev mailbox, device lab, quick demo sign-in).
   * Opt-in only (KVITTEL_DEMO_MODE=1) and structurally impossible on a real
   * deployment: it is ignored whenever a DATABASE_URL (real PostgreSQL) or a
   * Railway environment is present. Absence of the variable means OFF.
   */
  demoMode: demoModeAllowed(),
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? "mock") as "mock" | "stripe",
  mailProvider: (process.env.MAIL_PROVIDER ?? (process.env.RESEND_API_KEY ? "resend" : "devmailbox")) as "devmailbox" | "smtp" | "resend",
  resendApiKey: process.env.RESEND_API_KEY,
  mailFrom: process.env.MAIL_FROM,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  kvittelRetentionDays: Number(process.env.KVITTEL_RETENTION_DAYS ?? 30),
};

/** Payment capability that is real (never the mock) — gates whether paid kvittels can be sold. */
export function realPaymentsReady(): boolean {
  return env.paymentProvider === "stripe" && !!env.stripeSecretKey && !!env.stripeWebhookSecret;
}
export function realMailReady(): boolean {
  return env.mailProvider === "resend" && !!env.resendApiKey && !!env.mailFrom;
}
/** True when a customer can genuinely pay and be notified: real provider+mail, or an explicit local DEMO. */
export function commerceReady(): boolean {
  return env.demoMode || (realPaymentsReady() && realMailReady());
}

export function integrationStatus() {
  return [
    { key: "database", status: process.env.DATABASE_URL ? "configured" : "embedded", detail: process.env.DATABASE_URL ? `PostgreSQL · ${dbHost(process.env.DATABASE_URL)}` : "PGlite embedded PostgreSQL (.data/pglite)" },
    { key: "payments", status: env.paymentProvider === "mock" ? (env.demoMode ? "mock" : "missing_credentials") : realPaymentsReady() ? "configured" : "missing_credentials", detail: env.paymentProvider },
    { key: "email", status: env.mailProvider === "devmailbox" ? (env.demoMode ? "mock" : "missing_credentials") : realMailReady() ? "configured" : "missing_credentials", detail: env.mailProvider },
    { key: "devices", status: "simulated", detail: "Device protocol v1 live; field hardware not connected" },
    { key: "camera", status: "not_installed", detail: "video_proof flag off" },
    { key: "whatsapp", status: "not_connected", detail: "Requires approved business integration" },
    { key: "invoices", status: "not_connected", detail: "Tax documents must come from a licensed invoicing provider" },
    { key: "fx_rates", status: "not_connected", detail: "Fixed per-currency price lists; no conversion" },
  ] as const;
}

/** Host only — never the credentials. */
function dbHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "DATABASE_URL";
  }
}
