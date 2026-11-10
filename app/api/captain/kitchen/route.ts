import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import type { KitchenStation } from "@/types";

const STATIONS = new Set<KitchenStation>(["MAIN", "BAR", "BAKERY", "DESSERT", "OTHER"]);

/** Kitchen tickets for the signed-in captain's assigned tables only. */
export async function GET(request: Request) {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;
  try {
    const stationParam = new URL(request.url).searchParams.get("station");
    const station =
      stationParam && STATIONS.has(stationParam as KitchenStation)
        ? (stationParam as KitchenStation)
        : undefined;
    const assigned = new Set(captain.assignedTableIds ?? []);
    const kitchen = await orderService.listKitchen(captain.restaurantId, station);
    const scoped = kitchen.filter((order) => assigned.has(order.tableId));
    return NextResponse.json({ success: true, data: scoped });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load kitchen tickets" }, { status: 500 });
  }
}
