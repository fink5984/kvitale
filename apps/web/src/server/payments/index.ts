import "server-only";
import { env, realPaymentsReady } from "../env";
import { mockProvider } from "./mock";
import { stripeProvider } from "./stripe";
import type { PaymentProvider } from "./types";

/**
 * Real payments only. The mock provider exists solely in an explicit local DEMO
 * (see env.demoMode) — a production deployment can never fall back to it silently.
 */
export function activeProvider(): PaymentProvider {
  if (realPaymentsReady()) return stripeProvider;
  if (env.demoMode) return mockProvider;
  throw new Error("payments_unavailable");
}

export function providerById(id: string): PaymentProvider | null {
  if (id === "mock") return env.demoMode ? mockProvider : null;
  if (id === "stripe") return realPaymentsReady() ? stripeProvider : null;
  return null;
}
