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
 * Frozen on the line when it is added:
 * dish name, variant, unit price, add-on prices, item discount, and `gstRateSnapshot`.
 *
 * Frozen on the order as `billingSettingsSnapshot` at create:
 * price mode, supply type, GST rate, packaging method/amount/percent, and service-charge type/amount/percent.
 * Append and cancel pass that object into `calculateRestaurantBill`. They do not read the outlet's
 * current packaging or service settings.
 *
 * Orders written before `billingSettingsSnapshot` existed are reconciled from `billSnapshot`:
 * price mode and supply type come from that breakdown, and packaging and service charge are frozen
 * as a fixed per-order amount equal to the amounts already stored. Mixed-rate lines keep
 * `gstRateSnapshot`, or the order's stored `taxRatePercent` when the line snapshot is missing.
 */
export const ORDER_BILL_SNAPSHOT_POLICY = "line price and gstRateSnapshot are historical; billingSettingsSnapshot freezes price mode, supply type, packaging, and service charge; legacy orders freeze those charges from billSnapshot";

const BILLING_KEYS = [
  "taxRatePercent",
  "taxLabel",
  "priceMode",
  "gstEnabled",
  "gstRatePercent",
  "supplyType",
  "packagingEnabled",
  "packagingMethod",
  "packagingAmount",
  "packagingPercent",
  "serviceChargeEnabled",
  "serviceChargeType",
  "serviceChargeAmount",
  "serviceChargePercent",
] as const;

export function freezeBillingSettings(
  billing?: RestaurantBillingSettings | null,
): RestaurantBillingSettings {
  const source = billing ?? {};
  const frozen: RestaurantBillingSettings = {};
  for (const key of BILLING_KEYS) {
    const value = source[key];
    if (value !== undefined) (frozen as Record<string, unknown>)[key] = value;
  }
  return frozen;
}

/** Legacy orders have no settings snapshot. Freeze the charges already stored on the bill. */
export function legacyFrozenBilling(bill?: BillBreakdown | null): RestaurantBillingSettings {
  return {
    priceMode: bill?.priceMode,
    supplyType: bill?.supplyType,
    taxLabel: bill?.taxLabel,
    gstRatePercent: bill?.gstRatePercent,
    gstEnabled: (bill?.gstRatePercent ?? 0) > 0 || (bill?.taxAmount ?? 0) > 0,
    packagingEnabled: (bill?.packagingCharge ?? 0) > 0,
    packagingMethod: "PER_ORDER",
    packagingAmount: bill?.packagingCharge ?? 0,
    serviceChargeEnabled: (bill?.serviceCharge ?? 0) > 0,
    serviceChargeType: "FIXED",
    serviceChargeAmount: bill?.serviceCharge ?? 0,
  };
}

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
  frozen?: RestaurantBillingSettings | null,
  historical?: BillBreakdown | null,
): RestaurantBillingSettings {
  if (frozen && (frozen.priceMode || frozen.packagingMethod || frozen.serviceChargeType || frozen.gstEnabled != null)) {
    return freezeBillingSettings(frozen);
  }
  return legacyFrozenBilling(historical);
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
