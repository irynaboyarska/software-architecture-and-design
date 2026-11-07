import type { PaymentStatus } from "../types.ts";
import type { StripeResponse } from "./StripeClient.ts";

export function normalizeStripeStatus(response: StripeResponse): PaymentStatus {
  switch (response.state) {
    case "succeeded":
      return "paid";
    case "requires_action":
      return "processing";
    default:
      return "failed";
  }
}