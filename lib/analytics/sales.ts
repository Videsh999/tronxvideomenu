import { roundMoney } from "@/lib/order-pricing";
import { localDateKey } from "@/lib/analytics/period";
import type { FiguresSource, RestaurantOrder } from "@/types";

const inactive = new Set(["CANCELLED", "REJECTED"]);

export function isActiveOrder(order: Pick<RestaurantOrder, "status">): boolean {
  return !inactive.has(order.status);
}

export function inIsoRange(iso: string, from?: string, to?: string): boolean {
  const t = new Date(iso).getTime();
  if (from && t < new Date(from).getTime()) return false;
  if (to && t > new Date(to).getTime()) return false;
  return true;
}

export function filterOrders(
  orders: RestaurantOrder[],
  from?: string,
  to?: string,
): RestaurantOrder[] {
  return orders.filter((order) => inIsoRange(order.createdAt, from, to));
}

export type SalesSummaryMetrics = {
  orderCount: number;
  activeOrderCount: number;
  grossSales: number;
  netSales: number;
  refundedAmount: number;
  paidOrders: number;
  cancelledOrRejected: number;
  cancelRate: number;
  averageTicket: number;
  from: string | null;
  to: string | null;
  figuresSource: FiguresSource;
};

export function computeSalesSummary(
  orders: RestaurantOrder[],
  from?: string,
  to?: string,
): SalesSummaryMetrics {
  const scoped = filterOrders(orders, from, to);
  const active = scoped.filter(isActiveOrder);
  const gross = active.reduce((sum, order) => sum + order.total, 0);
  let charges = 0;
  let refunds = 0;
  for (const order of scoped) {
    for (const entry of order.payment?.ledger ?? []) {
      if (!inIsoRange(entry.recordedAt, from, to)) continue;
      if (entry.kind === "CHARGE") charges += entry.amount;
      if (entry.kind === "REFUND") refunds += entry.amount;
    }
  }
  const cancelledOrRejected = scoped.filter((order) => inactive.has(order.status)).length;
  return {
    orderCount: scoped.length,
    activeOrderCount: active.length,
    grossSales: roundMoney(gross),
    netSales: roundMoney(charges - refunds),
    refundedAmount: roundMoney(refunds),
    paidOrders: active.filter((order) => order.payment?.status === "PAID").length,
    cancelledOrRejected,
    cancelRate: scoped.length ? roundMoney(cancelledOrRejected / scoped.length) : 0,
    averageTicket: active.length ? roundMoney(gross / active.length) : 0,
    from: from ?? null,
    to: to ?? null,
    figuresSource: "ACTUAL",
  };
}

export type DishSalesRow = {
  dishId: string;
  dishName: string;
  quantitySold: number;
  revenue: number;
};

export function computeDishSales(
  orders: RestaurantOrder[],
  from?: string,
  to?: string,
): DishSalesRow[] {
  const map = new Map<string, DishSalesRow>();
  for (const order of filterOrders(orders, from, to).filter(isActiveOrder)) {
    for (const item of order.items) {
      const cancelled = item.cancelledQuantity ?? 0;
      const qty = Math.max(0, item.quantity - cancelled);
      if (qty <= 0) continue;
      // itemTotal is already recomputed for remaining qty after partial cancel.
      const revenue = roundMoney(item.itemTotal);
      const existing = map.get(item.dishId);
      if (existing) {
        existing.quantitySold += qty;
        existing.revenue = roundMoney(existing.revenue + revenue);
      } else {
        map.set(item.dishId, {
          dishId: item.dishId,
          dishName: item.dishNameSnapshot,
          quantitySold: qty,
          revenue,
        });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.quantitySold - a.quantitySold || b.revenue - a.revenue);
}

export type DailySalesRow = {
  date: string;
  grossSales: number;
  orderVolume: number;
  complete: boolean;
};

export function computeDailySales(
  orders: RestaurantOrder[],
  from: string,
  to: string,
  timeZone = "Asia/Kolkata",
  now = new Date(),
): DailySalesRow[] {
  const scoped = filterOrders(orders, from, to).filter(isActiveOrder);
  const byDay = new Map<string, { gross: number; volume: number }>();
  for (const order of scoped) {
    const key = localDateKey(order.createdAt, timeZone);
    const row = byDay.get(key) ?? { gross: 0, volume: 0 };
    row.gross += order.total;
    row.volume += 1;
    byDay.set(key, row);
  }
  const today = localDateKey(now.toISOString(), timeZone);
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({
      date,
      grossSales: roundMoney(row.gross),
      orderVolume: row.volume,
      complete: date < today,
    }));
}

export function comparePeriods(
  orders: RestaurantOrder[],
  currentFrom: string,
  currentTo: string,
  previousFrom: string,
  previousTo: string,
) {
  const current = computeSalesSummary(orders, currentFrom, currentTo);
  const previous = computeSalesSummary(orders, previousFrom, previousTo);
  const grossDelta = roundMoney(current.grossSales - previous.grossSales);
  const grossDeltaPct =
    previous.grossSales > 0 ? roundMoney((grossDelta / previous.grossSales) * 100) : null;
  return {
    current,
    previous,
    grossDelta,
    grossDeltaPct,
    figuresSource: "ACTUAL" as FiguresSource,
  };
}
