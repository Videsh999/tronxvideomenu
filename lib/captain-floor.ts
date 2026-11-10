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

/** Next kitchen ticket number. Lines with no number count as ticket 1. */
export function nextKotNumber(items: { kotNumber?: number }[]) {
  if (items.length === 0) return 1;
  return items.reduce((max, item) => Math.max(max, item.kotNumber ?? 1), 1) + 1;
}

/** Live occupied time: minutes under an hour, otherwise h:mm. */
export function formatOccupiedDuration(openedAt: string | undefined, now: number) {
  if (!openedAt) return "—";
  const start = new Date(openedAt).getTime();
  if (!Number.isFinite(start)) return "—";
  const minutes = Math.max(0, Math.floor((now - start) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}:${String(rest).padStart(2, "0")}`;
}

/** Whole rupees for the floor cards. The amount is the server total. */
export function formatRupeeTotal(amount: number) {
  const rounded = Math.round(Number.isFinite(amount) ? amount : 0);
  return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(rounded)}`;
}

export function groupTablesBySection<T extends { area?: string; section?: string; tableNumber: number }>(
  tables: T[],
) {
  const groups = new Map<string, T[]>();
  for (const table of tables) {
    const key = table.area?.trim() || table.section?.trim() || "Floor";
    const list = groups.get(key) ?? [];
    list.push(table);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([name, rows]) => ({
    name,
    tables: [...rows].sort((a, b) => a.tableNumber - b.tableNumber),
  }));
}

/** Subtotal, tax, and total already stored by calculateRestaurantBill. */
export function runningBillFromServer(order: {
  subtotal: number;
  taxAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  total: number;
}) {
  const split = (order.cgstAmount ?? 0) + (order.sgstAmount ?? 0) + (order.igstAmount ?? 0);
  return {
    subtotal: order.subtotal,
    tax: order.taxAmount ?? split,
    total: order.total,
  };
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
