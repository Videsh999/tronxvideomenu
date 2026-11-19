import type { OrderItemSnapshot } from "@/types";

export type CancellationRow = { orderLineId: string; quantityCancelled: number };

/**
 * Quantity to write for a line whose cancelledQuantity was stripped.
 * Returns null when the line already has the field. Returns 0 when no cancellation rows exist.
 */
export function plannedCancelledQuantity(
  item: Pick<OrderItemSnapshot, "lineId" | "cancelledQuantity">,
  rows: CancellationRow[],
): number | null {
  if (item.cancelledQuantity != null) return null;
  if (!item.lineId) return 0;
  return rows
    .filter((row) => row.orderLineId === item.lineId)
    .reduce((sum, row) => sum + row.quantityCancelled, 0);
}
