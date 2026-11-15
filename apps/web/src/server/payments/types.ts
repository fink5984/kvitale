export interface CheckoutRequest {
  orderId: string;
  ref: string;
  amountMinor: number;
  currency: string;
  email: string;
  locale: string;
  successUrl: string;
  cancelUrl: string;
}

export interface VerifiedEvent {
  eventId: string;
  type: "payment.succeeded" | "payment.failed" | "refund.succeeded" | "other";
  providerRef: string;
  amountMinor: number | null;
  currency: string | null;
}

export interface PaymentProvider {
  id: "mock" | "stripe";
  isDemo: boolean;
  createCheckout(req: CheckoutRequest): Promise<{ providerRef: string; redirectUrl: string }>;
  /** Must verify signature + timestamp tolerance; returns null when invalid. */
  verifyWebhook(rawBody: string, headers: Headers): Promise<VerifiedEvent | null>;
  refund(providerRef: string, amountMinor: number, currency: string): Promise<{ ok: boolean; refundRef: string; error?: string }>;
}
