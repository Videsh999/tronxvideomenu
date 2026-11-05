/** Pure financial helpers — all POS/QR totals must be recomputed server-side with these. */

export type PricedLineInput = {
  unitPrice: number;
  quantity: number;
  addonTotals: number[];
  itemDiscountAmount?: number; // absolute currency, applied after qty
};

export type BillTotalsInput = {
  lineTotals: number[];
  billDiscountAmount?: number;
  taxRatePercent?: number; // e.g. 5 for 5% GST on (subtotal - bill discount)
};

export type BillTotals = {
  itemsSubtotal: number;
  itemDiscounts: number;
  billDiscount: number;
  taxableAmount: number;
  taxAmount: number;
  total: number;
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function lineItemTotal(input: PricedLineInput): number {
  if (input.quantity < 1) throw new Error("Quantity must be at least 1.");
  if (input.unitPrice < 0 || input.addonTotals.some((value) => value < 0)) {
    throw new Error("Prices cannot be negative.");
  }
  const unitWithAddons = input.unitPrice + input.addonTotals.reduce((sum, value) => sum + value, 0);
  const gross = unitWithAddons * input.quantity;
  const discount = Math.max(0, input.itemDiscountAmount ?? 0);
  if (discount > gross) throw new Error("Item discount cannot exceed the line total.");
  return roundMoney(gross - discount);
}

export function computeBillTotals(input: BillTotalsInput): BillTotals {
  const itemsSubtotal = roundMoney(input.lineTotals.reduce((sum, value) => sum + value, 0));
  const billDiscount = Math.max(0, input.billDiscountAmount ?? 0);
  if (billDiscount > itemsSubtotal) throw new Error("Bill discount cannot exceed the subtotal.");
  const taxableAmount = roundMoney(itemsSubtotal - billDiscount);
  const taxRate = Math.max(0, input.taxRatePercent ?? 0);
  if (taxRate > 100) throw new Error("Tax rate cannot exceed 100%.");
  const taxAmount = roundMoney((taxableAmount * taxRate) / 100);
  return {
    itemsSubtotal,
    itemDiscounts: 0,
    billDiscount,
    taxableAmount,
    taxAmount,
    total: roundMoney(taxableAmount + taxAmount),
  };
}

export function amountRemaining(orderTotal: number, amountPaid: number): number {
  return roundMoney(Math.max(0, orderTotal - Math.max(0, amountPaid)));
}
