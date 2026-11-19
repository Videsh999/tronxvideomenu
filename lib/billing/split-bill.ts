import { billFromStoredLines } from "@/lib/billing/order-bill";
import { roundMoney } from "@/lib/order-pricing";
import type { BillBreakdown, OrderItemSnapshot, RestaurantBillingSettings } from "@/types";

export type SplitAllocation = {
  stay: BillBreakdown;
  move: BillBreakdown;
  stayDiscount: number;
  moveDiscount: number;
};

/**
 * Split one stored bill into two. Packaging and service stay on the original check.
 * Any paisa left by rounding is added to the new check so the two totals equal the original.
 */
export function allocateSplitBills(input: {
  staying: OrderItemSnapshot[];
  moving: OrderItemSnapshot[];
  billDiscountAmount: number;
  billing: RestaurantBillingSettings;
  orderTaxRatePercent?: number;
  historicalBill?: BillBreakdown | null;
}): SplitAllocation {
  const discount = Math.max(0, input.billDiscountAmount);
  const staySub = lineSubtotal(input.staying);
  const moveSub = lineSubtotal(input.moving);
  const base = staySub + moveSub;
  const stayDiscount = base > 0 ? roundMoney((discount * staySub) / base) : 0;
  const moveDiscount = roundMoney(Math.max(0, discount - stayDiscount));
  const original = billFromStoredLines({
    items: [...input.staying, ...input.moving],
    billDiscountAmount: discount,
    billing: input.billing,
    orderTaxRatePercent: input.orderTaxRatePercent,
    historicalBill: input.historicalBill,
  });
  const stay = billFromStoredLines({
    items: input.staying,
    billDiscountAmount: stayDiscount,
    billing: input.billing,
    orderTaxRatePercent: input.orderTaxRatePercent,
    historicalBill: input.historicalBill,
  });
  const moveBilling: RestaurantBillingSettings = {
    ...input.billing,
    packagingEnabled: false,
    serviceChargeEnabled: false,
  };
  const calculatedMove = billFromStoredLines({
    items: input.moving,
    billDiscountAmount: moveDiscount,
    billing: moveBilling,
    orderTaxRatePercent: input.orderTaxRatePercent,
  });
  const drift = roundMoney(original.total - (stay.total + calculatedMove.total));
  const move = applyPaiseDrift(calculatedMove, drift);
  return { stay, move, stayDiscount, moveDiscount };
}

function lineSubtotal(items: OrderItemSnapshot[]) {
  return roundMoney(
    items
      .filter((item) => item.quantity - (item.cancelledQuantity ?? 0) > 0)
      .reduce((sum, item) => sum + item.itemTotal, 0),
  );
}

function applyPaiseDrift(bill: BillBreakdown, drift: number): BillBreakdown {
  if (drift === 0) return bill;
  const taxAmount = roundMoney(bill.taxAmount + drift);
  if (bill.supplyType === "INTER_STATE") {
    return {
      ...bill,
      taxAmount,
      igstAmount: roundMoney(bill.igstAmount + drift),
      total: roundMoney(bill.total + drift),
    };
  }
  return {
    ...bill,
    taxAmount,
    cgstAmount: roundMoney(bill.cgstAmount + drift),
    total: roundMoney(bill.total + drift),
  };
}
