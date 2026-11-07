import type { KitchenStation, OrderStatus, OrderSummary } from "@/types";

export type KitchenColumnId = "new" | "cooking" | "ready" | "served";

export const KITCHEN_COLUMNS: {
  id: KitchenColumnId;
  title: string;
  statuses: OrderStatus[];
  next: OrderStatus | null;
  back: OrderStatus | null;
  nextLabel: string;
  accent: string;
}[] = [
  {
    id: "new",
    title: "New",
    statuses: ["ACCEPTED"],
    next: "PREPARING",
    back: null,
    nextLabel: "Start cooking",
    accent: "#f59e0b",
  },
  {
    id: "cooking",
    title: "Cooking",
    statuses: ["PREPARING"],
    next: "READY",
    back: "ACCEPTED",
    nextLabel: "Mark ready",
    accent: "#fb923c",
  },
  {
    id: "ready",
    title: "Ready",
    statuses: ["READY"],
    next: "SERVED",
    back: "PREPARING",
    nextLabel: "Mark served",
    accent: "#34d399",
  },
  {
    id: "served",
    title: "Served",
    statuses: ["SERVED"],
    next: null,
    back: "READY",
    nextLabel: "Done",
    accent: "#94a3b8",
  },
];

export const KITCHEN_STATIONS: { id: KitchenStation | "ALL"; label: string }[] = [
  { id: "ALL", label: "All stations" },
  { id: "MAIN", label: "Main kitchen" },
  { id: "BAR", label: "Bar" },
  { id: "BAKERY", label: "Bakery" },
  { id: "DESSERT", label: "Desserts" },
  { id: "OTHER", label: "Other" },
];

export function kitchenColumnForStatus(status: OrderStatus): KitchenColumnId | null {
  const column = KITCHEN_COLUMNS.find((entry) => entry.statuses.includes(status));
  return column?.id ?? null;
}

export function ordersInKitchenColumn(orders: OrderSummary[], columnId: KitchenColumnId) {
  const column = KITCHEN_COLUMNS.find((entry) => entry.id === columnId)!;
  return orders.filter((order) => column.statuses.includes(order.status));
}

export function formatTicketTimer(iso: string, nowMs = Date.now()) {
  const elapsed = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 1000));
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = elapsed % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function ticketUrgency(iso: string, nowMs = Date.now()): "ok" | "watch" | "late" {
  const minutes = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
  if (minutes >= 20) return "late";
  if (minutes >= 12) return "watch";
  return "ok";
}

export function filterOrdersByStation(orders: OrderSummary[], station: KitchenStation | "ALL") {
  if (station === "ALL") return orders;
  return orders
    .map((order) => ({
      ...order,
      items: order.items.filter((item) => (item.kitchenStation ?? "MAIN") === station),
    }))
    .filter((order) => order.items.length > 0);
}
