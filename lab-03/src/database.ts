export type StockRow = { productId: string; available: number };
export type OrderRow = {
  id: string;
  status: string;
  total: number;
  paymentStatus?: string;
};

export const database = {
  stock: new Map<string, StockRow>(),
  orders: new Map<string, OrderRow>(),
};

export function resetDatabase(): void {
  database.stock.clear();
  database.orders.clear();
}
