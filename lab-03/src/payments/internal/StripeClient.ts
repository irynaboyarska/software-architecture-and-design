export type StripePayload = {
  id: string;
  amount: number;
  currency: string;
  metadata: { orderId: string };
};

export type StripeResponse = {
  charge_id: string;
  state: "succeeded" | "requires_action" | "declined";
};

export class StripeClient {
  async createCharge(payload: StripePayload): Promise<StripeResponse> {
    const state = payload.id.startsWith("fail_") ? "declined" : "succeeded";
    return { charge_id: `ch_${payload.id}`, state };
  }
}