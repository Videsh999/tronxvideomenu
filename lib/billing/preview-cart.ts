import type { RestaurantBillingSettings } from "@/types";
import { calculateRestaurantBill } from "@/lib/billing/calculate-bill";
import { lineItemTotal, roundMoney } from "@/lib/order-pricing";

/**
 * Staff-screen bill preview. POS and captain must call this (or the server)
 * so the amount on screen is `calculateRestaurantBill`, including packaging,
 * service charge, inclusive prices, mixed rates, IGST, and cancelled quantities.
 */
export type PreviewCartLine = {
  unitPrice: number;
  quantity: number;
  cancelledQuantity?: number;
  addonUnitPrices?: number[];
  /** Discount for the original line quantity, prorated to the active quantity. */
  itemDiscountAmount?: number;
  gstRatePercent?: number;
};

export function previewStaffCartBill(input: {
  lines: PreviewCartLine[];
  billDiscountAmount?: number;
  billing?: RestaurantBillingSettings | null;
}) {
  const active = input.lines.flatMap((line) => {
    const cancelled = line.cancelledQuantity ?? 0;
    const activeQty = line.quantity - cancelled;
    if (activeQty < 1) return [];
    const lineTotal = lineItemTotal({
      unitPrice: line.unitPrice,
      quantity: activeQty,
      addonTotals: line.addonUnitPrices ?? [],
      itemDiscountAmount: line.itemDiscountAmount
        ? roundMoney((line.itemDiscountAmount * activeQty) / Math.max(1, line.quantity))
        : 0,
    });
    return [{
      lineTotal,
      quantity: activeQty,
      gstRatePercent: line.gstRatePercent,
    }];
  });

  return calculateRestaurantBill({
    lines: active,
    billDiscountAmount: input.billDiscountAmount,
    billing: input.billing,
  });
}
