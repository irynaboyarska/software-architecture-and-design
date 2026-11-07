import { database } from "../database.ts";

export class StockRepository {
  find(productId: string) {
    return database.stock.get(productId);
  }

  // This low-level write API lets any module bypass Inventory invariants.
  updateAvailable(productId: string, available: number): void {
    database.stock.set(productId, { productId, available });
  }
}
