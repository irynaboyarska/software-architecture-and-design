import test from "node:test";
import assert from "node:assert/strict";
import { normalizeStripeStatus } from "../src/payments/internal/stripeStatus.ts";
import type { StripeResponse } from "../src/payments/internal/StripeClient.ts";

test("succeeded is normalized to paid", () => {
  assert.equal(normalizeStripeStatus({ charge_id: "ch_1", state: "succeeded" }), "paid");
});

test("requires_action is normalized to processing", () => {
  assert.equal(normalizeStripeStatus({ charge_id: "ch_2", state: "requires_action" }), "processing");
});

test("declined is normalized to failed", () => {
  assert.equal(normalizeStripeStatus({ charge_id: "ch_3", state: "declined" }), "failed");
});

test("unknown provider status is normalized to failed", () => {
  const unknown = { charge_id: "ch_4", state: "something_new" } as unknown as StripeResponse;
  assert.equal(normalizeStripeStatus(unknown), "failed");
});