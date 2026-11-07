import type { PaymentRequest, PaymentResult } from "./types.ts";
import { resolveProvider } from "./internal/registry.ts";

export type { PaymentRequest, PaymentResult, PaymentStatus } from "./types.ts";

// The provider is chosen inside Payments (PAYMENT_PROVIDER, default "stripe"):
// consumers keep calling this one function and never see provider details.
export async function authorizePayment(request: PaymentRequest): Promise<PaymentResult> {
  return resolveProvider(process.env.PAYMENT_PROVIDER).authorize(request);
}