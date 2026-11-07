import { database } from "../database.ts";
import type { CartLine } from "../shared/calculateTotal.ts";
import { reserveStock } from "../inventory/index.ts";
import { authorizePayment } from "../payments/index.ts";

export type PaymentDetails = { token: string; currency: string };

export class OrderService {
  private readonly authorize: typeof authorizePayment;

  constructor(authorize: typeof authorizePayment = authorizePayment) {
    this.authorize = authorize;
  }

  async placeOrder(orderId: string, lines: CartLine[], total: number, payment: PaymentDetails) {
    reserveStock(lines);

    database.orders.set(orderId, { id: orderId, status: "created", total });
    const result = await this.authorize({
      orderId,
      paymentToken: payment.token,
      amount: total,
      currency: payment.currency,
    });

    const order = database.orders.get(orderId)!;
    order.paymentStatus = result.status;
    order.status = result.status === "paid" ? "confirmed" : "payment_pending";
    return { ...order };
  }
}