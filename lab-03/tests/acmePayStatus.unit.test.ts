import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAcmePayStatus } from "../src/payments/internal/acmePayStatus.ts";
import type { AcmePayResponse } from "../src/payments/internal/AcmePayClient.ts";

test("APPROVED is normalized to paid", () => {
  assert.equal(normalizeAcmePayStatus({ txn: "t1", outcome: "APPROVED" }), "paid");
});

test("IN_REVIEW is normalized to processing", () => {
  assert.equal(normalizeAcmePayStatus({ txn: "t2", outcome: "IN_REVIEW" }), "processing");
});

test("REJECTED is normalized to failed", () => {
  assert.equal(normalizeAcmePayStatus({ txn: "t3", outcome: "REJECTED" }), "failed");
});

test("unknown AcmePay outcome is normalized to failed", () => {
  const unknown = { txn: "t4", outcome: "SOMETHING_NEW" } as unknown as AcmePayResponse;
  assert.equal(normalizeAcmePayStatus(unknown), "failed");
});