import { roundMoney } from "@/lib/order-pricing";
import { filterOrders, isActiveOrder } from "@/lib/analytics/sales";
import type { RestaurantOrder } from "@/types";

/** Operational table insights — no customer PII. */
export type TablePerformanceRow = {
  tableNumber: number;
  tableId?: string;
  orderCount: number;
  grossSales: number;
  averageTicket: number;
  paidOrders: number;
  unpaidOpenOrders: number;
  lastOrderAt: string | null;
  topDishName: string | null;
  topDishQuantity: number;
};

export function computeTablePerformance(
  orders: RestaurantOrder[],
  from?: string,
  to?: string,
): TablePerformanceRow[] {
  const scoped = filterOrders(orders, from, to).filter(isActiveOrder);
  const byTable = new Map<
    string,
    {
      tableNumber: number;
      tableId?: string;
      orderCount: number;
      grossSales: number;
      paidOrders: number;
      unpaidOpenOrders: number;
      lastOrderAt: string | null;
      dishes: Map<string, { name: string; qty: number }>;
    }
  >();

  for (const order of scoped) {
    if (!order.tableNumber || order.tableNumber < 1) continue;
    const key = order.tableId || `legacy:${order.tableNumber}`;
    const entry = byTable.get(key) ?? {
      tableNumber: order.tableNumber,
      tableId: order.tableId,
      orderCount: 0,
      grossSales: 0,
      paidOrders: 0,
      unpaidOpenOrders: 0,
      lastOrderAt: null as string | null,
      dishes: new Map<string, { name: string; qty: number }>(),
    };
    entry.orderCount += 1;
    entry.grossSales = roundMoney(entry.grossSales + order.total);
    if (order.payment?.status === "PAID") entry.paidOrders += 1;
    if (
      order.payment?.status !== "PAID" &&
      !["COMPLETED", "SERVED", "CANCELLED", "REJECTED"].includes(order.status)
    ) {
      entry.unpaidOpenOrders += 1;
    }
    if (!entry.lastOrderAt || order.createdAt > entry.lastOrderAt) {
      entry.lastOrderAt = order.createdAt;
    }
    if (!entry.tableId && order.tableId) entry.tableId = order.tableId;
    for (const item of order.items) {
      const cancelled = item.cancelledQuantity ?? 0;
      const qty = Math.max(0, item.quantity - cancelled);
      if (qty <= 0) continue;
      const dish = entry.dishes.get(item.dishId) ?? {
        name: item.dishNameSnapshot,
        qty: 0,
      };
      dish.qty += qty;
      entry.dishes.set(item.dishId, dish);
    }
    byTable.set(key, entry);
  }

  const rows: TablePerformanceRow[] = [];
  for (const entry of byTable.values()) {
    let topDishName: string | null = null;
    let topDishQuantity = 0;
    for (const dish of entry.dishes.values()) {
      if (dish.qty > topDishQuantity) {
        topDishQuantity = dish.qty;
        topDishName = dish.name;
      }
    }
    rows.push({
      tableNumber: entry.tableNumber,
      tableId: entry.tableId,
      orderCount: entry.orderCount,
      grossSales: entry.grossSales,
      averageTicket: entry.orderCount ? roundMoney(entry.grossSales / entry.orderCount) : 0,
      paidOrders: entry.paidOrders,
      unpaidOpenOrders: entry.unpaidOpenOrders,
      lastOrderAt: entry.lastOrderAt,
      topDishName,
      topDishQuantity,
    });
  }

  return rows.sort((a, b) => b.orderCount - a.orderCount || b.grossSales - a.grossSales);
}
