import { roundMoney } from "@/lib/order-pricing";
import type { RestaurantBillingSettings } from "@/types";

/**
 * One merged check keeps both bill discounts and both charges already frozen on the two bills.
 * Percentage settings are not reapplied. The carried charges are fixed amounts.
 */
export function reconcileMergedBill(input: {
  destinationDiscount: number;
  sourceDiscount: number;
  destinationBilling: RestaurantBillingSettings;
  destinationPackaging: number;
  destinationService: number;
  sourcePackaging: number;
  sourceService: number;
  itemsSubtotal: number;
}): { billDiscountAmount: number; billing: RestaurantBillingSettings } {
  const discount = Math.min(
    input.itemsSubtotal,
    roundMoney(Math.max(0, input.destinationDiscount) + Math.max(0, input.sourceDiscount)),
  );
  const packaging = roundMoney(Math.max(0, input.destinationPackaging) + Math.max(0, input.sourcePackaging));
  const service = roundMoney(Math.max(0, input.destinationService) + Math.max(0, input.sourceService));
  return {
    billDiscountAmount: discount,
    billing: {
      ...input.destinationBilling,
      packagingEnabled: packaging > 0,
      packagingMethod: "PER_ORDER",
      packagingAmount: packaging,
      serviceChargeEnabled: service > 0,
      serviceChargeType: "FIXED",
      serviceChargeAmount: service,
    },
  };
}
