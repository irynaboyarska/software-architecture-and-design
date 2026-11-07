import test from "node:test";
import assert from "node:assert/strict";
import { calculateTotal, type CartLine } from "../src/shared/calculateTotal.ts";
import { auditLog, runtimeConfig } from "../src/config.ts";

const lines: CartLine[] = [
  { productId: "book", unitPrice: 100, quantity: 2 },
  { productId: "pen", unitPrice: 10, quantity: 3 },
];

test("total is computed only from the arguments", () => {
  assert.equal(calculateTotal(lines, { taxRate: 0.2, discountPercent: 0 }), 276);
  assert.equal(calculateTotal(lines, { taxRate: 0.2, discountPercent: 10 }), 248.4);
});

test("global runtime config does not affect the result", () => {
  const savedTax = runtimeConfig.taxRate;
  const savedDiscount = runtimeConfig.discountPercent;
  try {
    runtimeConfig.taxRate = 0.9;
    runtimeConfig.discountPercent = 50;
    assert.equal(calculateTotal(lines, { taxRate: 0.2, discountPercent: 0 }), 276);
  } finally {
    runtimeConfig.taxRate = savedTax;
    runtimeConfig.discountPercent = savedDiscount;
  }
});

test("input lines are not mutated", () => {
  const input: CartLine[] = lines.map((line) => Object.freeze({ ...line }));
  const before = JSON.stringify(input);

  calculateTotal(input, { taxRate: 0.2, discountPercent: 0 });

  assert.equal(JSON.stringify(input), before);
});

test("calculation does not write to the audit log", () => {
  const before = auditLog.length;

  calculateTotal(lines, { taxRate: 0.2, discountPercent: 0 });

  assert.equal(auditLog.length, before);
});