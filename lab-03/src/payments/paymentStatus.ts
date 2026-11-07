import type { StripeResponse } from "./internal/StripeClient.ts";

export type PaymentStatus = "paid" | "processing" | "failed";

export function normalizePaymentStatus(response: StripeResponse): PaymentStatus {
  switch (response.state) {
    case "succeeded":
      return "paid";
    case "requires_action":
      return "processing";
    default:
      return "failed";
  }
}