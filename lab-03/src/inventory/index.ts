import { database } from "../database.ts";

export type StockLine = { productId: string; quantity: number };

export class InsufficientStockError extends Error {
  readonly productId: string;

  constructor(productId: string) {
    super(`Insufficient stock for ${productId}`);
    this.name = "InsufficientStockError";
    this.productId = productId;
  }
}

// Reserves every line or none of them: the invariant available >= 0 is owned here.
export function reserveStock(lines: readonly StockLine[]): void {
  const requested = new Map<string, number>();
  for (const line of lines) {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new RangeError(`Invalid quantity for ${line.productId}`);
    }
    requested.set(line.productId, (requested.get(line.productId) ?? 0) + line.quantity);
  }

  for (const [productId, quantity] of requested) {
    const row = database.stock.get(productId);
    if (!row || row.available < quantity) {
      throw new InsufficientStockError(productId);
    }
  }

  for (const [productId, quantity] of requested) {
    const row = database.stock.get(productId)!;
    database.stock.set(productId, { productId, available: row.available - quantity });
  }
}