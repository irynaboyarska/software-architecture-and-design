import type { PaymentRequest, PaymentResult } from "../types.ts";
import { StripeClient, type StripePayload } from "./StripeClient.ts";
import { normalizeStripeStatus } from "./stripeStatus.ts";

const defaultClient = new StripeClient();

export async function authorizeWithStripe(
  request: PaymentRequest,
  client: StripeClient = defaultClient,
): Promise<PaymentResult> {
  const payload: StripePayload = {
    id: request.paymentToken,
    amount: Math.round(request.amount * 100),
    currency: request.currency,
    metadata: { orderId: request.orderId },
  };

  const response = await client.createCharge(payload);
  return { status: normalizeStripeStatus(response), reference: response.charge_id };
}