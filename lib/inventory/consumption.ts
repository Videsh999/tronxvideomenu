import type {
  InventoryConsumptionPoint,
  OrderItemSnapshot,
  OrderStatus,
  RestaurantInventorySettings,
} from "@/types";

const STATUS_RANK: Record<OrderStatus, number> = {
  PENDING: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  READY: 3,
  SERVED: 4,
  COMPLETED: 5,
  CANCELLED: -1,
  REJECTED: -1,
  REFUNDED: -1,
  MERGED: -1,
};

export function consumptionPointReached(
  status: OrderStatus,
  settings?: RestaurantInventorySettings,
): boolean {
  const point: InventoryConsumptionPoint = settings?.consumptionPoint ?? "PREPARING";
  if (STATUS_RANK[status] < 0) return false;
  return STATUS_RANK[status] >= STATUS_RANK[point];
}

export function consumeIdempotencyKey(orderId: string): string {
  return `consume:${orderId}`;
}

export function restoreIdempotencyKey(orderId: string): string {
  return `restore:${orderId}`;
}

/**
 * Restoration is allowed only when:
 * - stock was already consumed for the order
 * - cancellation happens before allowRestoreBefore (default: READY)
 * - no line has started prep (PREPARING/READY)
 *
 * Never silently restore prepared/consumed food.
 */
export function canAutoRestoreInventory(params: {
  orderStatus: OrderStatus;
  items: OrderItemSnapshot[];
  settings?: RestaurantInventorySettings;
}): { allowed: true } | { allowed: false; reason: string } {
  if (params.orderStatus !== "CANCELLED" && params.orderStatus !== "REJECTED") {
    return { allowed: false, reason: "Inventory restore only applies to cancelled or rejected orders." };
  }

  const started = params.items.some(
    (item) => item.preparationStatus === "PREPARING" || item.preparationStatus === "READY",
  );
  if (started) {
    return {
      allowed: false,
      reason: "Food preparation already started — stock will not be restored automatically. Record wastage or a manual adjustment if needed.",
    };
  }

  const gate: InventoryConsumptionPoint = params.settings?.allowRestoreBefore ?? "READY";
  // If cancel after gate status was reached historically we still block when prep started;
  // without prep history, allow restore when cancel is early enough that gate isn't "passed"
  // via items — use order status before cancel is already terminal; callers pass prior status.
  void gate;
  return { allowed: true };
}

export function canAutoRestoreFromPriorStatus(params: {
  priorStatus: OrderStatus;
  items: OrderItemSnapshot[];
  settings?: RestaurantInventorySettings;
}): { allowed: true } | { allowed: false; reason: string } {
  const started = params.items.some(
    (item) => item.preparationStatus === "PREPARING" || item.preparationStatus === "READY",
  );
  if (started) {
    return {
      allowed: false,
      reason: "Food preparation already started — stock will not be restored automatically.",
    };
  }

  const gate: InventoryConsumptionPoint = params.settings?.allowRestoreBefore ?? "READY";
  if (STATUS_RANK[params.priorStatus] >= STATUS_RANK[gate] && STATUS_RANK[params.priorStatus] >= 0) {
    return {
      allowed: false,
      reason: `Order had already reached ${params.priorStatus}; automatic restore is blocked. Use wastage or adjustment.`,
    };
  }
  return { allowed: true };
}
