import test from "node:test";
import assert from "node:assert/strict";
import { CheckoutController } from "../src/checkout/CheckoutController.ts";
import { OrderService } from "../src/orders/OrderService.ts";
import { database, resetDatabase } from "../src/database.ts";
import { auditLog, runtimeConfig } from "../src/config.ts";

test.beforeEach(() => {
  resetDatabase();
  auditLog.length = 0;
  runtimeConfig.taxRate = 0.2;
  runtimeConfig.discountPercent = 0;
  database.stock.set("book", { productId: "book", available: 5 });
  database.stock.set("pen", { productId: "pen", available: 1 });
});

const publicKeys = ["orderId", "paymentStatus", "status", "total"];

test("paid response exposes only the public fields", async () => {
  const response = await new CheckoutController().checkout({
    orderId: "order-1",
    paymentToken: "tok_valid",
    currency: "UAH",
    lines: [{ productId: "book", unitPrice: 100, quantity: 2 }],
  });

  assert.deepEqual(Object.keys(response).sort(), publicKeys);
});

test("failed response exposes only the public fields", async () => {
  const response = await new CheckoutController().checkout({
    orderId: "order-2",
    paymentToken: "fail_card",
    currency: "UAH",
    lines: [{ productId: "book", unitPrice: 50, quantity: 1 }],
  });

  assert.deepEqual(Object.keys(response).sort(), publicKeys);
  assert.equal(response.paymentStatus, "failed");
  assert.equal(response.status, "payment_pending");
});

test("processing payment keeps the order pending through the Payments contract", async () => {
  const orders = new OrderService(async () => ({ status: "processing", reference: "ref-1" }));

  const response = await new CheckoutController(orders).checkout({
    orderId: "order-3",
    paymentToken: "tok_any",
    currency: "UAH",
    lines: [{ productId: "book", unitPrice: 100, quantity: 1 }],
  });

  assert.deepEqual(response, {
    orderId: "order-3",
    status: "payment_pending",
    total: 120,
    paymentStatus: "processing",
  });
});

test("out-of-stock checkout changes no stock and creates no order", async () => {
  await assert.rejects(
    () => new CheckoutController().checkout({
      orderId: "order-4",
      paymentToken: "tok_valid",
      currency: "UAH",
      lines: [
        { productId: "book", unitPrice: 100, quantity: 2 },
        { productId: "pen", unitPrice: 10, quantity: 2 },
      ],
    }),
    /Insufficient stock for pen/,
  );

  assert.equal(database.stock.get("book")?.available, 5);
  assert.equal(database.stock.get("pen")?.available, 1);
  assert.equal(database.orders.size, 0);
});

test("checkout records the audit entry after the total is calculated", async () => {
  await new CheckoutController().checkout({
    orderId: "order-5",
    paymentToken: "tok_valid",
    currency: "UAH",
    lines: [{ productId: "book", unitPrice: 100, quantity: 2 }],
  });

  assert.deepEqual(auditLog, ["total_calculated:240"]);
});