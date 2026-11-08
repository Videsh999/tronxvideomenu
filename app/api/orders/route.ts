import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export async function GET(request: Request) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;

    const restaurant = await restaurantService.getById(admin.restaurantId);
    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurant not found" },
        { status: 404 },
      );
    }

    const featureCheck = requireRestaurantFeature(
      restaurant,
      "ORDER_MANAGEMENT",
    );
    if (!featureCheck.allowed) {
      return NextResponse.json(
        { success: false, error: featureCheck.reason },
        { status: 403 },
      );
    }

    const history = new URL(request.url).searchParams.get("history") === "done";
    const orders = history
      ? await orderService.listDoneHistory(admin.restaurantId)
      : await orderService.listForRestaurant(admin.restaurantId);
    return NextResponse.json(
      { success: true, data: orders },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load orders." },
      { status: 500 },
    );
  }
}
