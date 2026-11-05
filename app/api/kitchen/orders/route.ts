import { NextResponse } from "next/server";
import {
  requireRestaurantAdmin,
  requireCaptain,
  unauthorizedResponse,
} from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import type { KitchenStation } from "@/types";

const STATIONS = new Set(["MAIN", "BAR", "BAKERY", "DESSERT", "OTHER"]);

export async function GET(request: Request) {
  try {
    const adminResult = await requireRestaurantAdmin();
    const captainResult = !adminResult.admin ? await requireCaptain("ORDER_MANAGEMENT") : null;
    if (!adminResult.admin && !captainResult?.captain) return unauthorizedResponse();

    const restaurantId = adminResult.admin?.restaurantId ?? captainResult!.captain!.restaurantId;
    const restaurant = await restaurantService.getById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
    }
    const feature = requireRestaurantFeature(restaurant, "KITCHEN_DISPLAY");
    if (!feature.allowed) {
      return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
    }

    const stationParam = new URL(request.url).searchParams.get("station");
    const station =
      stationParam && STATIONS.has(stationParam)
        ? (stationParam as KitchenStation)
        : undefined;

    const orders = await orderService.listKitchen(restaurantId, station);
    return NextResponse.json(
      { success: true, data: orders },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load kitchen orders." },
      { status: 500 },
    );
  }
}
