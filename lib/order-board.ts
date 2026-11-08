import type { OrderStatus, OrderSummary } from "@/types";

/** Clear floor stages — hides the confusing Accepted vs Preparing split from staff. */
export type OrderBoardStage = "new" | "kitchen" | "ready" | "done";

export const ORDER_BOARD_STAGES: {
  id: OrderBoardStage;
  title: string;
  hint: string;
  statuses: OrderStatus[];
}[] = [
  { id: "new", title: "New", hint: "Step 1 — Accept to print KOT and send to kitchen", statuses: ["PENDING"] },
  { id: "kitchen", title: "Kitchen", hint: "Step 2 — Cooking — mark ready when the pass is done", statuses: ["ACCEPTED", "PREPARING"] },
  { id: "ready", title: "Ready", hint: "Step 3 — Take food to the table, then mark served", statuses: ["READY"] },
  {
    id: "done",
    title: "Done",
    hint: "Finished — served, completed, cancelled, or refunded",
    statuses: ["SERVED", "COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"],
  },
];

export function stageForStatus(status: OrderStatus): OrderBoardStage {
  if (status === "PENDING") return "new";
  if (status === "ACCEPTED" || status === "PREPARING") return "kitchen";
  if (status === "READY") return "ready";
  return "done";
}

export function ordersInStage(orders: OrderSummary[], stage: OrderBoardStage) {
  const statuses = ORDER_BOARD_STAGES.find((entry) => entry.id === stage)!.statuses;
  return orders.filter((order) => statuses.includes(order.status));
}

export function statusLabel(status: OrderStatus): string {
  const labels: Record<OrderStatus, string> = {
    PENDING: "New",
    ACCEPTED: "In kitchen",
    PREPARING: "Cooking",
    READY: "Ready to serve",
    SERVED: "Served",
    COMPLETED: "Completed",
    CANCELLED: "Cancelled",
    REJECTED: "Rejected",
    REFUNDED: "Refunded",
  };
  return labels[status];
}

export function formatOrderClock(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.replace("T", " ").slice(0, 16);
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Primary floor action for each status. Accept jumps straight into the kitchen. */
export function primaryFloorAction(status: OrderStatus): { status: OrderStatus; label: string } | null {
  if (status === "PENDING") return { status: "PREPARING", label: "Accept & send to kitchen" };
  if (status === "ACCEPTED") return { status: "PREPARING", label: "Start cooking" };
  if (status === "PREPARING") return { status: "READY", label: "Mark ready" };
  if (status === "READY") return { status: "SERVED", label: "Mark served" };
  if (status === "SERVED") return { status: "COMPLETED", label: "Complete order" };
  return null;
}

export function canCancelOrder(status: OrderStatus) {
  return status === "PENDING" || status === "ACCEPTED";
}

export function canReprintKot(status: OrderStatus) {
  return !["PENDING", "REJECTED"].includes(status);
}
