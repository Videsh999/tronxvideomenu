import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import { inventoryService, InventoryServiceError } from "@/lib/services/inventory.service";
import { dishRepository } from "@/lib/repositories/dish.repository";

type RouteContext = { params: Promise<{ dishId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const auth = await requireAdminRestaurantFeature("INVENTORY");
  if (!auth.ok) return auth.response;
  try {
    const { dishId } = await params;
    const dish = await dishRepository.findById(dishId);
    if (!dish || dish.restaurantId !== auth.restaurantId) {
      return NextResponse.json({ success: false, error: "Dish not found." }, { status: 404 });
    }
    const data = await inventoryService.dishProfitability(
      auth.restaurantId,
      dishId,
      dish.price,
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to calculate profitability." }, { status: 500 });
  }
}
