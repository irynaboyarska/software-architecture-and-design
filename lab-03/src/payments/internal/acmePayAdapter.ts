import { AcmePayClient, type AcmePayRequest } from "./AcmePayClient.ts";
import type { PaymentProvider } from "./provider.ts";
import { normalizeAcmePayStatus } from "./acmePayStatus.ts";

export function createAcmePayProvider(client: AcmePayClient = new AcmePayClient()): PaymentProvider {
  return {
    async authorize(request) {
      const payload: AcmePayRequest = {
        merchant_ref: request.orderId,
        payment_source: request.paymentToken,
        total: request.amount.toFixed(2),
        cur: request.currency,
      };

      const response = await client.submit(payload);
      return { status: normalizeAcmePayStatus(response), reference: response.txn };
    },
  };
}