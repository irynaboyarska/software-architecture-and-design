import type { PaymentStatus } from "../types.ts";
import type { AcmePayResponse } from "./AcmePayClient.ts";

export function normalizeAcmePayStatus(response: AcmePayResponse): PaymentStatus {
  switch (response.outcome) {
    case "APPROVED":
      return "paid";
    case "IN_REVIEW":
      return "processing";
    default:
      return "failed";
  }
}