import { roundMoney } from "@/lib/order-pricing";
import { filterOrders, inIsoRange, isActiveOrder } from "@/lib/analytics/sales";
import type { FiguresSource, RestaurantOrder } from "@/types";

/**
 * Detailed financial rollup for reconciliation.
 * Order totals (gross) are separate from ledger money movement (collected/net).
 */
export type FinancialRollup = {
  orderCount: number;
  activeOrderCount: number;
  cancelledOrRejected: number;
  /** Sum of line/item economics before bill discount — uses order.subtotal on active orders. */
  itemsSubtotal: number;
  /** Sum of billDiscountAmount on active orders. */
  billDiscounts: number;
  /** Sum of taxAmount on active orders. */
  taxAmount: number;
  /** Sum of order.total on active orders (includes tax; discounts already applied). */
  grossOrderSales: number;
  /** Ledger CHARGE amounts in period (by recordedAt). */
  paymentsCollected: number;
  /** Ledger REFUND amounts in period. */
  refunds: number;
  /** paymentsCollected − refunds. */
  netCollected: number;
  /** max(0, grossOrderSales − paymentsCollected) for active non-refunded orders — approximate outstanding. */
  outstandingApprox: number;
  averageOrderValue: number;
  from: string | null;
  to: string | null;
  figuresSource: FiguresSource;
};

export function computeFinancialRollup(
  orders: RestaurantOrder[],
  from?: string,
  to?: string,
): FinancialRollup {
  const scoped = filterOrders(orders, from, to);
  const active = scoped.filter(isActiveOrder);
  const itemsSubtotal = active.reduce((sum, order) => sum + (order.subtotal ?? 0), 0);
  const billDiscounts = active.reduce((sum, order) => sum + (order.billDiscountAmount ?? 0), 0);
  const taxAmount = active.reduce((sum, order) => sum + (order.taxAmount ?? 0), 0);
  const grossOrderSales = active.reduce((sum, order) => sum + order.total, 0);

  let paymentsCollected = 0;
  let refunds = 0;
  for (const order of scoped) {
    for (const entry of order.payment?.ledger ?? []) {
      if (!inIsoRange(entry.recordedAt, from, to)) continue;
      if (entry.kind === "CHARGE") paymentsCollected += entry.amount;
      if (entry.kind === "REFUND") refunds += entry.amount;
    }
  }

  // Outstanding: active orders still owing (total − amountPaid), ignore fully cancelled.
  let outstandingApprox = 0;
  for (const order of active) {
    if (order.status === "REFUNDED") continue;
    const paid = order.payment?.amountPaid ?? 0;
    outstandingApprox += Math.max(0, order.total - paid);
  }

  return {
    orderCount: scoped.length,
    activeOrderCount: active.length,
    cancelledOrRejected: scoped.filter((order) => !isActiveOrder(order)).length,
    itemsSubtotal: roundMoney(itemsSubtotal),
    billDiscounts: roundMoney(billDiscounts),
    taxAmount: roundMoney(taxAmount),
    grossOrderSales: roundMoney(grossOrderSales),
    paymentsCollected: roundMoney(paymentsCollected),
    refunds: roundMoney(refunds),
    netCollected: roundMoney(paymentsCollected - refunds),
    outstandingApprox: roundMoney(outstandingApprox),
    averageOrderValue: active.length ? roundMoney(grossOrderSales / active.length) : 0,
    from: from ?? null,
    to: to ?? null,
    figuresSource: "ACTUAL",
  };
}

export type ReconciliationRow = {
  metric: string;
  expected: number;
  calculated: number;
  difference: number;
  explanation: string;
  pass: boolean;
};

export function reconcileFinancial(
  calculated: FinancialRollup,
  expected: Partial<Record<keyof FinancialRollup, number>>,
  tolerance = 0.01,
): ReconciliationRow[] {
  const keys: (keyof FinancialRollup)[] = [
    "itemsSubtotal",
    "billDiscounts",
    "taxAmount",
    "grossOrderSales",
    "paymentsCollected",
    "refunds",
    "netCollected",
    "outstandingApprox",
    "averageOrderValue",
    "activeOrderCount",
    "cancelledOrRejected",
  ];
  const rows: ReconciliationRow[] = [];
  for (const key of keys) {
    if (expected[key] == null) continue;
    const calc = Number(calculated[key]);
    const exp = Number(expected[key]);
    const difference = roundMoney(calc - exp);
    rows.push({
      metric: key,
      expected: exp,
      calculated: calc,
      difference,
      explanation:
        Math.abs(difference) <= tolerance
          ? "Matches fixture expectation."
          : `Mismatch on ${key}: expected ${exp}, got ${calc}.`,
      pass: Math.abs(difference) <= tolerance,
    });
  }
  return rows;
}

export type OutletRevenueRow = {
  restaurantId: string;
  grossOrderSales: number;
  netCollected: number;
};

export function revenueByOutlet(
  byOutlet: { restaurantId: string; orders: RestaurantOrder[] }[],
  from?: string,
  to?: string,
): OutletRevenueRow[] {
  return byOutlet.map((entry) => {
    const rollup = computeFinancialRollup(entry.orders, from, to);
    return {
      restaurantId: entry.restaurantId,
      grossOrderSales: rollup.grossOrderSales,
      netCollected: rollup.netCollected,
    };
  });
}
