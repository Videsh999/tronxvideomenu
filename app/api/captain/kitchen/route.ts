import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import { tableService } from "@/lib/services/table.service";
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
    const [kitchen, tables] = await Promise.all([
      orderService.listKitchen(captain.restaurantId, station),
      tableService.list(captain.restaurantId),
    ]);
    const assignedNumbers = new Set(
      tables.filter((table) => assigned.has(table.id)).map((table) => table.tableNumber),
    );
    const scoped = kitchen.filter((order) => assignedNumbers.has(order.tableNumber));
    return NextResponse.json({ success: true, data: scoped });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load kitchen tickets" }, { status: 500 });
  }
}
