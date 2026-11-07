import { auditLog, runtimeConfig } from "../config.ts";

export type CartLine = {
  productId: string;
  unitPrice: number;
  quantity: number;
  lineTotal?: number;
};

// Intentionally impure: this function reads globals, mutates its argument and logs.
export function calculateTotal(lines: CartLine[]): number {
  let subtotal = 0;

  for (const line of lines) {
    line.lineTotal = line.unitPrice * line.quantity;
    subtotal += line.lineTotal;
  }

  const discounted = subtotal * (1 - runtimeConfig.discountPercent / 100);
  const total = Number((discounted * (1 + runtimeConfig.taxRate)).toFixed(2));
  auditLog.push(`total_calculated:${total}`);
  return total;
}
