import "server-only";

export const env = {
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  isProd: process.env.NODE_ENV === "production",
  /** DEMO mode: mock payments, dev mailbox, device lab, quick demo sign-in. Never on in a real deployment. */
  demoMode: process.env.KVITTEL_DEMO_MODE !== "0",
  paymentProvider: (process.env.PAYMENT_PROVIDER ?? "mock") as "mock" | "stripe",
  mailProvider: (process.env.MAIL_PROVIDER ?? "devmailbox") as "devmailbox" | "smtp" | "resend",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  kvittelRetentionDays: Number(process.env.KVITTEL_RETENTION_DAYS ?? 30),
};

export function integrationStatus() {
  return [
    { key: "database", status: process.env.DATABASE_URL ? "configured" : "embedded", detail: process.env.DATABASE_URL ? `PostgreSQL · ${dbHost(process.env.DATABASE_URL)}` : "PGlite embedded PostgreSQL (.data/pglite)" },
    { key: "payments", status: env.paymentProvider === "mock" ? "mock" : env.stripeSecretKey ? "configured" : "missing_credentials", detail: env.paymentProvider },
    { key: "email", status: env.mailProvider === "devmailbox" ? "mock" : "configured", detail: env.mailProvider },
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
