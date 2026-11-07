import type { StripeResponse } from "../payments/internal/StripeClient.ts";

export function mapPaymentStatus(response: StripeResponse): "paid" | "pending" | "failed" {
  if (response.state === "succeeded") return "paid";
  if (response.state === "requires_action") return "pending";
  return "failed";
}
