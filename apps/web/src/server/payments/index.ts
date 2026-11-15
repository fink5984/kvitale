import "server-only";
import { env } from "../env";
import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

export function activeProvider(): PaymentProvider {
  if (env.paymentProvider === "stripe" && env.stripeSecretKey) return stripeProvider;
  if (env.paymentProvider === "stripe" && !env.demoMode) throw new Error("Stripe selected but not configured");
  return mockProvider;
}

export function providerById(id: string): PaymentProvider | null {
  if (id === "mock") return env.demoMode ? mockProvider : null;
  if (id === "stripe") return stripeProvider;
  return null;
}
