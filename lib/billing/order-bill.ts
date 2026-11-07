import type {
  BillBreakdown,
  Category,
  Dish,
  OrderItemSnapshot,
  RestaurantBillingSettings,
} from "@/types";
import { calculateRestaurantBill } from "@/lib/billing/calculate-bill";
import { resolveLineTaxRate } from "@/lib/billing/resolve-tax-rate";
import { lineItemTotal, roundMoney } from "@/lib/order-pricing";

/**
 * Snapshot policy for order money.
 *
 * Frozen on the line when it is added (never re-read from the live catalog on append or cancel):
 * dish name, variant id and name, unit price, add-on names and unit prices, item discount,
 * and `gstRateSnapshot` (dish, then category, then outlet rate at that moment).
 *
 * Frozen on the order from the first `billSnapshot` when present:
 * `priceMode` and `supplyType`. Later toggles of those outlet settings must not tax a line twice
 * or flip CGST/SGST to IGST for lines already on the check.
 *
 * Recomputed when lines are added or cancelled, always through `calculateRestaurantBill`:
 * packaging, service charge, discount cap, tax split, and total. Packaging and service charge
 * follow the outlet settings at recompute time because they depend on the open check, not on a
 * historical catalog price.
 *
 * Lines written before `gstRateSnapshot` existed keep `order.taxRatePercent`. They do not pick up
 * a later dish or category rate.
 */
export const ORDER_BILL_SNAPSHOT_POLICY = "line price and gstRateSnapshot are historical; priceMode and supplyType stick to the first billSnapshot; packaging and service charge recompute from current outlet settings via calculateRestaurantBill";

export function snapshotGstRate(input: {
  dish?: Pick<Dish, "taxRatePercent"> | null;
  category?: Pick<Category, "taxRatePercent"> | null;
  billing?: RestaurantBillingSettings | null;
}): number {
  return resolveLineTaxRate(input).rate;
}

export function lineGstRateForRecompute(
  item: Pick<OrderItemSnapshot, "gstRateSnapshot">,
  orderTaxRatePercent: number | undefined,
): number {
  if (item.gstRateSnapshot != null && Number.isFinite(item.gstRateSnapshot)) {
    return Math.max(0, Math.min(100, item.gstRateSnapshot));
  }
  return Math.max(0, Math.min(100, orderTaxRatePercent ?? 0));
}

export function billingForRecompute(
  restaurantBilling: RestaurantBillingSettings | null | undefined,
  historical: BillBreakdown | null | undefined,
): RestaurantBillingSettings {
  return {
    ...(restaurantBilling ?? {}),
    priceMode: historical?.priceMode ?? restaurantBilling?.priceMode,
    supplyType: historical?.supplyType ?? restaurantBilling?.supplyType,
  };
}

export function billFromStoredLines(input: {
  items: OrderItemSnapshot[];
  billDiscountAmount?: number;
  billing?: RestaurantBillingSettings | null;
  orderTaxRatePercent?: number;
  historicalBill?: BillBreakdown | null;
}): BillBreakdown {
  const active = input.items.filter((item) => item.quantity - (item.cancelledQuantity ?? 0) > 0);
  const subtotal = roundMoney(active.reduce((sum, item) => sum + item.itemTotal, 0));
  const requestedDiscount = Math.max(0, input.billDiscountAmount ?? 0);
  const discount = Math.min(requestedDiscount, subtotal);
  return calculateRestaurantBill({
    lines: active.map((item) => ({
      lineTotal: item.itemTotal,
      quantity: Math.max(0, item.quantity - (item.cancelledQuantity ?? 0)),
      gstRatePercent: lineGstRateForRecompute(item, input.orderTaxRatePercent),
    })),
    billDiscountAmount: discount,
    billing: billingForRecompute(input.billing, input.historicalBill),
  });
}

export function billMoneyFields(bill: BillBreakdown) {
  return {
    subtotal: bill.itemsSubtotal,
    billDiscountAmount: bill.billDiscount,
    taxRatePercent: bill.gstRatePercent,
    taxAmount: bill.taxAmount,
    packagingCharge: bill.packagingCharge,
    serviceCharge: bill.serviceCharge,
    cgstAmount: bill.cgstAmount,
    sgstAmount: bill.sgstAmount,
    igstAmount: bill.igstAmount,
    billSnapshot: bill,
    total: bill.total,
  };
}

export type CancelLineRequest = { lineId: string; quantity: number };

/**
 * Apply absolute cancellation quantities. Calling twice with the same requests
 * after the first result is persisted increases cancelled quantity only by the new request.
 */
export function planLineCancellation(
  items: OrderItemSnapshot[],
  requests: CancelLineRequest[],
): { items: OrderItemSnapshot[]; plannedCancelled: Record<string, number> } {
  const nextItems = items.map((item) => ({ ...item }));
  const plannedCancelled: Record<string, number> = {};

  for (const request of requests) {
    if (!Number.isInteger(request.quantity) || request.quantity < 1) {
      throw new Error("Cancellation quantity must be a positive integer.");
    }
    const index = nextItems.findIndex((item) => item.lineId === request.lineId);
    if (index < 0) throw new Error(`Order line ${request.lineId} not found.`);
    const line = nextItems[index]!;
    const alreadyCancelled = line.cancelledQuantity ?? 0;
    const remaining = line.quantity - alreadyCancelled;
    if (request.quantity > remaining) {
      throw new Error(
        `Cannot cancel ${request.quantity} of ${line.dishNameSnapshot}; only ${remaining} remaining.`,
      );
    }
    if (line.preparationStatus === "PREPARING" || line.preparationStatus === "READY") {
      throw new Error(`${line.dishNameSnapshot} is already being prepared and cannot be cancelled.`);
    }

    const newCancelled = alreadyCancelled + request.quantity;
    const activeQty = line.quantity - newCancelled;
    const addonTotals = (line.addons ?? []).map((addon) => addon.unitPriceSnapshot);
    const itemTotal =
      activeQty < 1
        ? 0
        : lineItemTotal({
            unitPrice: line.unitPriceSnapshot,
            quantity: activeQty,
            addonTotals,
            itemDiscountAmount: line.itemDiscountAmount
              ? roundMoney((line.itemDiscountAmount * activeQty) / Math.max(1, line.quantity))
              : 0,
          });

    nextItems[index] = {
      ...line,
      cancelledQuantity: newCancelled,
      itemTotal,
    };
    plannedCancelled[request.lineId] = newCancelled;
  }

  return { items: nextItems, plannedCancelled };
}

export function linesReflectCancellation(
  items: OrderItemSnapshot[],
  plannedCancelled: Record<string, number> | null | undefined,
): boolean {
  if (!plannedCancelled || Object.keys(plannedCancelled).length === 0) return false;
  return Object.entries(plannedCancelled).every(([lineId, quantity]) => {
    const line = items.find((item) => item.lineId === lineId);
    return (line?.cancelledQuantity ?? 0) >= quantity;
  });
}
