import type { PaymentRequest, PaymentResult } from "../types.ts";

export type PaymentProvider = {
  authorize(request: PaymentRequest): Promise<PaymentResult>;
};