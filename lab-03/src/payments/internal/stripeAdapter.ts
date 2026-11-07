import { StripeClient, type StripePayload } from "./StripeClient.ts";
import type { PaymentProvider } from "./provider.ts";
import { normalizeStripeStatus } from "./stripeStatus.ts";

export function createStripeProvider(client: StripeClient = new StripeClient()): PaymentProvider {
  return {
    async authorize(request) {
      const payload: StripePayload = {
        id: request.paymentToken,
        amount: Math.round(request.amount * 100),
        currency: request.currency,
        metadata: { orderId: request.orderId },
      };

      const response = await client.createCharge(payload);
      return { status: normalizeStripeStatus(response), reference: response.charge_id };
    },
  };
}