import type { OrderStatus } from "@/types";

/** Explicit order state machine shared by QR, POS, captain, and KDS. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["ACCEPTED", "PREPARING", "CANCELLED", "REJECTED"],
  ACCEPTED: ["PREPARING", "CANCELLED", "REJECTED"],
  /** Kitchen can step back ACCEPTED ← PREPARING ← READY ← SERVED on the KDS board. */
  PREPARING: ["READY", "ACCEPTED", "CANCELLED"],
  READY: ["SERVED", "COMPLETED", "PREPARING"],
  SERVED: ["COMPLETED", "READY"],
  COMPLETED: ["REFUNDED"],
  CANCELLED: [],
  REJECTED: [],
  REFUNDED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalStatus(status: OrderStatus): boolean {
  return ORDER_TRANSITIONS[status]?.length === 0;
}
