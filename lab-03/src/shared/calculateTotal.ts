export type CartLine = {
  productId: string;
  unitPrice: number;
  quantity: number;
};

export type PricingRules = {
  taxRate: number;
  discountPercent: number;
};

export function calculateTotal(lines: readonly CartLine[], rules: PricingRules): number {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const discounted = subtotal * (1 - rules.discountPercent / 100);
  return Number((discounted * (1 + rules.taxRate)).toFixed(2));
}