import test from "node:test";
import assert from "node:assert/strict";
import { CheckoutController } from "../src/checkout/CheckoutController.ts";
import { database, resetDatabase } from "../src/database.ts";
import { auditLog, runtimeConfig } from "../src/config.ts";

test.beforeEach(() => {
  resetDatabase();
  auditLog.length = 0;
  runtimeConfig.taxRate = 0.2;
  runtimeConfig.discountPercent = 0;
  database.stock.set("book", { productId: "book", available: 5 });
});

test("successful checkout preserves the public response", async () => {
  const response = await new CheckoutController().checkout({
    orderId: "order-1",
    paymentToken: "tok_valid",
    currency: "UAH",
    lines: [{ productId: "book", unitPrice: 100, quantity: 2 }],
  });

  assert.deepEqual(response, {
    orderId: "order-1",
    status: "confirmed",
    total: 240,
    paymentStatus: "paid",
  });
  assert.equal(database.stock.get("book")?.available, 3);
});

test("failed payment keeps the existing API behaviour", async () => {
  const response = await new CheckoutController().checkout({
    orderId: "order-2",
    paymentToken: "fail_card",
    currency: "UAH",
    lines: [{ productId: "book", unitPrice: 50, quantity: 1 }],
  });

  assert.equal(response.paymentStatus, "failed");
  assert.equal(response.status, "payment_pending");
});

test("checkout rejects an unavailable product", async () => {
  await assert.rejects(
    () => new CheckoutController().checkout({
      orderId: "order-3",
      paymentToken: "tok_valid",
      currency: "UAH",
      lines: [{ productId: "book", unitPrice: 100, quantity: 6 }],
    }),
    /Insufficient stock/,
  );
});
