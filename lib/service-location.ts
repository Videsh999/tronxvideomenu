import type { RestaurantTable } from "@/types";

export function locationType(location: RestaurantTable): "TABLE" | "ROOM" {
  return location.locationType === "ROOM" ? "ROOM" : "TABLE";
}

export function locationName(location: RestaurantTable, includeNumber = true) {
  const kind = locationType(location) === "ROOM" ? "Room" : "Table";
  return includeNumber ? `${kind} ${location.tableNumber}` : kind;
}

export function locationMenuUrl(origin: string, slug: string, location: RestaurantTable) {
  const key = locationType(location) === "ROOM" ? "room" : "table";
  return `${origin}/menu/${encodeURIComponent(slug)}?${key}=${location.tableNumber}`;
}

export function orderLocationName(order: { tableNumber: number; locationType?: "TABLE" | "ROOM" }) {
  if (order.tableNumber <= 0) return "Counter";
  return `${order.locationType === "ROOM" ? "Room" : "Table"} ${order.tableNumber}`;
}
