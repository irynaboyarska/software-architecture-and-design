import { database } from "../../database.ts";

export function markOrderPaid(orderId: string, paymentStatus: string): void {
  const order = database.orders.get(orderId);
  if (order) {
    order.status = paymentStatus === "paid" ? "confirmed" : "payment_pending";
    order.paymentStatus = paymentStatus;
  }
}
