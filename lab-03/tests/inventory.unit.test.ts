import test from "node:test";
import assert from "node:assert/strict";
import { database, resetDatabase } from "../src/database.ts";
import { InsufficientStockError, reserveStock } from "../src/inventory/index.ts";

function snapshot() {
  return JSON.stringify([...database.stock.entries()]);
}

test.beforeEach(() => {
  resetDatabase();
  database.stock.set("book", { productId: "book", available: 5 });
  database.stock.set("pen", { productId: "pen", available: 1 });
});

test("reserveStock reserves every line", () => {
  reserveStock([
    { productId: "book", quantity: 2 },
    { productId: "pen", quantity: 1 },
  ]);

  assert.equal(database.stock.get("book")?.available, 3);
  assert.equal(database.stock.get("pen")?.available, 0);
});

test("out-of-stock line leaves every stock row unchanged", () => {
  const before = snapshot();

  assert.throws(
    () => reserveStock([
      { productId: "book", quantity: 2 },
      { productId: "pen", quantity: 2 },
    ]),
    (error: unknown) => error instanceof InsufficientStockError && error.productId === "pen",
  );

  assert.equal(snapshot(), before);
});

test("unknown product leaves stock unchanged", () => {
  const before = snapshot();

  assert.throws(
    () => reserveStock([
      { productId: "book", quantity: 1 },
      { productId: "ghost", quantity: 1 },
    ]),
    InsufficientStockError,
  );

  assert.equal(snapshot(), before);
});

test("duplicate lines are summed before the availability check", () => {
  const before = snapshot();

  assert.throws(
    () => reserveStock([
      { productId: "book", quantity: 3 },
      { productId: "book", quantity: 3 },
    ]),
    InsufficientStockError,
  );

  assert.equal(snapshot(), before);
});

test("non-positive or fractional quantity is rejected without changes", () => {
  const before = snapshot();

  for (const quantity of [0, -1, 1.5]) {
    assert.throws(() => reserveStock([{ productId: "book", quantity }]), RangeError);
  }

  assert.equal(snapshot(), before);
});