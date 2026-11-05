import type { InventoryConsumptionLine, OrderItemSnapshot } from "@/types";
import { roundQty } from "@/lib/inventory/units";

/**
 * Compute ingredient quantities to restore for specific cancelled order lines.
 * Only restores remaining unrestored quantity for matching orderLineId rows.
 * Never includes lines that are not in the cancelled set.
 */
export function quantitiesToRestoreForLines(params: {
  consumptionLines: InventoryConsumptionLine[];
  cancelledOrderLineIds: string[];
  orderItems: OrderItemSnapshot[];
}): { ingredientId: string; quantityBase: number; orderLineId: string }[] {
  const cancelled = new Set(params.cancelledOrderLineIds);
  const prepared = new Set(
    params.orderItems
      .filter(
        (item) =>
          item.lineId &&
          (item.preparationStatus === "PREPARING" || item.preparationStatus === "READY"),
      )
      .map((item) => item.lineId!),
  );

  const out: { ingredientId: string; quantityBase: number; orderLineId: string }[] = [];
  for (const line of params.consumptionLines) {
    if (!line.orderLineId || !cancelled.has(line.orderLineId)) continue;
    if (prepared.has(line.orderLineId)) continue;
    const already = line.restoredQuantityBase ?? 0;
    const remaining = roundQty(line.quantityBase - already);
    if (remaining <= 0) continue;
    out.push({
      ingredientId: line.ingredientId,
      quantityBase: remaining,
      orderLineId: line.orderLineId,
    });
  }
  return out;
}

export function lineRestoreIdempotencyKey(orderId: string, orderLineId: string): string {
  return `restore-line:${orderId}:${orderLineId}`;
}
