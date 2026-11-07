import assert from 'node:assert/strict';
import  test  from 'node:test';
import { authorizePayment } from "../src/payments/index.ts";

test("authorizePayment returns a provider-neutral paid result", async () => {
  const result = await authorizePayment({
    orderId: "order-1",
    paymentToken: "tok_valid",
    amount: 240,
    currency: "UAH",
  });

  assert.deepEqual(result, { status: "paid", reference: "ch_tok_valid" });
});

test("authorizePayment returns a provider-neutral failed result", async () => {
  const result = await authorizePayment({
    orderId: "order-2",
    paymentToken: "fail_card",
    amount: 50,
    currency: "UAH",
  });

  assert.deepEqual(Object.keys(result).sort(), ["reference", "status"]);
  assert.equal(result.status, "failed");
});