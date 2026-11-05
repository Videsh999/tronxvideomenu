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
      const activeOrder = activeOrderForTable(orders, table.tableNumber);
      return { table, activeOrder };
    });
}
