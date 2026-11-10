import type { OrderSummary, RestaurantTable, TableStatus } from "@/types";

export const TABLE_STATUS_LABEL: Record<TableStatus, string> = {
  OPEN: "Available",
  OCCUPIED: "Occupied",
  BILL_REQUESTED: "Bill requested",
  PAYMENT_PENDING: "Payment pending",
  CLEANING: "Cleaning",
  CLOSED: "Closed",
};

export const TABLE_STATUS_STYLE: Record<TableStatus, string> = {
  OPEN: "border-emerald-200 bg-emerald-50 text-emerald-800",
  OCCUPIED: "border-amber-200 bg-amber-50 text-amber-900",
  BILL_REQUESTED: "border-violet-200 bg-violet-50 text-violet-900",
  PAYMENT_PENDING: "border-sky-200 bg-sky-50 text-sky-900",
  CLEANING: "border-neutral-300 bg-neutral-100 text-neutral-700",
  CLOSED: "border-rose-200 bg-rose-50 text-rose-800",
};

export function isTableSeatAvailable(status: TableStatus) {
  return status === "OPEN";
}

export function canAddOrderToTable(status: TableStatus) {
  return status !== "CLOSED" && status !== "CLEANING";
}

export function activeOrderForTable(orders: OrderSummary[], tableNumber: number) {
  return (
    orders.find(
      (order) =>
        order.tableNumber === tableNumber &&
        !["COMPLETED", "CANCELLED", "REJECTED", "SERVED"].includes(order.status),
    ) ?? null
  );
}

export function enrichCaptainTables(
  tables: RestaurantTable[],
  orders: OrderSummary[],
  assignedIds: Set<string>,
) {
  return tables
    .filter((table) => assignedIds.has(table.id))
    .map((table) => {
      const activeOrders = orders.filter((order) => order.tableId === table.id && !["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"].includes(order.status));
      const activeOrder = activeOrders[0] ?? activeOrderForTable(orders, table.tableNumber);
      return {
        table,
        activeOrder,
        activeOrders,
        orderCount: activeOrders.length,
        runningTotal: activeOrders.reduce((sum, order) => sum + order.total, 0),
        amountPaid: activeOrders.reduce((sum, order) => sum + (order.payment?.amountPaid ?? 0), 0),
        unsentItems: activeOrders.reduce((sum, order) => {
          const sent = new Set(order.kotLineIds ?? []);
          return sum + order.items.filter((item) => item.lineId !== undefined && !sent.has(item.lineId) && (item.cancelledQuantity ?? 0) < item.quantity).reduce((qty, item) => qty + item.quantity - (item.cancelledQuantity ?? 0), 0);
        }, 0),
      };
    });
}
