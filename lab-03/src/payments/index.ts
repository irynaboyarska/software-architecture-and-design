import type { PaymentRequest, PaymentResult } from "./types.ts";
import { authorizeWithStripe } from "./internal/stripeAdapter.ts";

export type { PaymentRequest, PaymentResult, PaymentStatus } from "./types.ts";

export function authorizePayment(request: PaymentRequest): Promise<PaymentResult> {
  return authorizeWithStripe(request);
}