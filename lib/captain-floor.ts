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

export type KotItemStatus = "sent" | "preparing" | "ready" | "served";

/** Kitchen state for a sent line. Missing KDS data stays "sent". */
export function kotItemStatus(
  item: { preparationStatus?: string },
  orderStatus?: string,
): KotItemStatus {
  if (orderStatus === "SERVED") return "served";
  if (item.preparationStatus === "READY") return "ready";
  if (item.preparationStatus === "PREPARING") return "preparing";
  return "sent";
}

const CLOSED_ORDER = new Set(["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED", "MERGED"]);

export function isRunningOrder(status: string) {
  return !CLOSED_ORDER.has(status);
}

/**
 * Split a stored total into whole-paisa shares. The shares add back to the total.
 * The last shares receive the leftover paisa.
 */
export function equalSplitAmounts(total: number, ways: number) {
  if (!Number.isInteger(ways) || ways < 2 || ways > 20) {
    throw new Error("Split the bill into 2 to 20 shares.");
  }
  const cents = Math.round((Number.isFinite(total) ? total : 0) * 100);
  if (cents < 0) throw new Error("A bill total cannot be negative.");
  const base = Math.floor(cents / ways);
  let leftover = cents - base * ways;
  return Array.from({ length: ways }, () => {
    const share = base + (leftover > 0 ? 1 : 0);
    if (leftover > 0) leftover -= 1;
    return share / 100;
  });
}

/** Active lines move to the new bill. Neither side may be empty. */
export function partitionBillItems<T extends { lineId?: string; quantity: number; cancelledQuantity?: number }>(
  items: T[],
  lineIds: string[],
) {
  const wanted = new Set(lineIds);
  const active = (item: T) => item.quantity - (item.cancelledQuantity ?? 0) > 0;
  const moving = items.filter((item) => item.lineId && wanted.has(item.lineId) && active(item));
  const staying = items.filter((item) => !item.lineId || !wanted.has(item.lineId));
  if (moving.length === 0) throw new Error("Select at least one item to split.");
  if (!staying.some(active)) throw new Error("Leave at least one item on the original bill.");
  const missing = lineIds.filter((id) => !moving.some((item) => item.lineId === id));
  if (missing.length) throw new Error("One of the selected items is not on this bill.");
  return { moving, staying };
}

/** Next kitchen ticket number. Lines with no number count as ticket 1. */
export function nextKotNumber(items: { kotNumber?: number }[]) {
  if (items.length === 0) return 1;
  return items.reduce((max, item) => Math.max(max, item.kotNumber ?? 1), 1) + 1;
}

/** Shift moved tickets past the destination's highest number. The old number is kept. */
export function renumberMovedKots<T extends { kotNumber?: number; previousKotNumber?: number }>(
  destinationItems: { kotNumber?: number }[],
  moving: T[],
) {
  const destMax = destinationItems.reduce((max, item) => Math.max(max, item.kotNumber ?? 0), 0);
  const sourceKots = [...new Set(moving.map((item) => item.kotNumber ?? 1))].sort((a, b) => a - b);
  const mapped = new Map(sourceKots.map((kot, index) => [kot, destMax + index + 1]));
  return moving.map((item) => ({
    ...item,
    previousKotNumber: item.kotNumber ?? 1,
    kotNumber: mapped.get(item.kotNumber ?? 1) ?? destMax + 1,
  }));
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
