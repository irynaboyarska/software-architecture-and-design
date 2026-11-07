import test from "node:test";
import assert from "node:assert/strict";
import { authorizePayment } from "../src/payments/index.ts";
import { CheckoutController } from "../src/checkout/CheckoutController.ts";
import { database, resetDatabase } from "../src/database.ts";

async function withProvider<T>(name: string | undefined, run: () => Promise<T>): Promise<T> {
  const saved = process.env.PAYMENT_PROVIDER;
  if (name === undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER = name;
  try {
    return await run();
  } finally {
    if (saved === undefined) delete process.env.PAYMENT_PROVIDER;
    else process.env.PAYMENT_PROVIDER = saved;
  }
}

const scenarios = [
  { token: "tok_ok", status: "paid" },
  { token: "proc_review", status: "processing" },
  { token: "fail_card", status: "failed" },
] as const;

for (const provider of ["stripe", "acmepay"]) {
  for (const { token, status } of scenarios) {
    test(`${provider}: ${token} is reported as ${status} through the public contract`, async () => {
      const result = await withProvider(provider, () =>
        authorizePayment({ orderId: "order-1", paymentToken: token, amount: 240, currency: "UAH" }),
      );

      assert.equal(result.status, status);
      assert.deepEqual(Object.keys(result).sort(), ["reference", "status"]);
    });
  }
}

test("default provider is used when PAYMENT_PROVIDER is not set", async () => {
  const result = await withProvider(undefined, () =>
    authorizePayment({ orderId: "order-2", paymentToken: "tok_ok", amount: 10, currency: "UAH" }),
  );

  assert.deepEqual(result, { status: "paid", reference: "ch_tok_ok" });
});

test("unknown provider name is rejected instead of silently falling back", async () => {
  await assert.rejects(
    () => withProvider("nope", () =>
      authorizePayment({ orderId: "order-3", paymentToken: "tok_ok", amount: 10, currency: "UAH" }),
    ),
    /Unknown payment provider: nope/,
  );
});

for (const provider of ["stripe", "acmepay"]) {
  test(`${provider}: Checkout response is identical for consumers`, async () => {
    const outcomes = [];
    for (const [i, { token }] of scenarios.entries()) {
      resetDatabase();
      database.stock.set("book", { productId: "book", available: 5 });
      outcomes.push(
        await withProvider(provider, () =>
          new CheckoutController().checkout({
            orderId: `order-${i}`,
            paymentToken: token,
            currency: "UAH",
            lines: [{ productId: "book", unitPrice: 100, quantity: 1 }],
          }),
        ),
      );
    }

    assert.deepEqual(outcomes, [
      { orderId: "order-0", status: "confirmed", total: 120, paymentStatus: "paid" },
      { orderId: "order-1", status: "payment_pending", total: 120, paymentStatus: "processing" },
      { orderId: "order-2", status: "payment_pending", total: 120, paymentStatus: "failed" },
    ]);
  });
}