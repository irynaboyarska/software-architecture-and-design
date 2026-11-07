import { calculateTotal, type CartLine } from "../shared/calculateTotal.ts";
import { OrderService } from "../orders/OrderService.ts";
import type { StripePayload } from "../payments/internal/StripeClient.ts";

export type CheckoutRequest = {
  orderId: string;
  paymentToken: string;
  currency: string;
  lines: CartLine[];
};

export class CheckoutController {
  private readonly orders: OrderService;

  constructor(orders = new OrderService()) {
    this.orders = orders;
  }

  async checkout(request: CheckoutRequest) {
    const total = calculateTotal(request.lines);

    // Deliberate leak: transport/controller code knows Stripe's payload shape.
    const stripePayload: StripePayload = {
      id: request.paymentToken,
      amount: Math.round(total * 100),
      currency: request.currency,
      metadata: { orderId: request.orderId },
    };

    const order = await this.orders.placeOrder(
      request.orderId,
      request.lines,
      total,
      stripePayload,
    );

    return {
      orderId: order.id,
      status: order.status,
      total: order.total,
      paymentStatus: order.paymentStatus,
    };
  }
}
