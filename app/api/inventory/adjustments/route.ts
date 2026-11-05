import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import { inventoryService, InventoryServiceError } from "@/lib/services/inventory.service";
import { stockAdjustSchema } from "@/lib/validations";

export async function GET() {
  const auth = await requireAdminRestaurantFeature("INVENTORY");
  if (!auth.ok) return auth.response;
  const [movements, lowStock, ingredients] = await Promise.all([
    inventoryService.listMovements(auth.restaurantId),
    inventoryService.lowStock(auth.restaurantId),
    inventoryService.listIngredients(auth.restaurantId),
  ]);
  return NextResponse.json(
    {
      success: true,
      data: {
        movements,
        lowStock,
        valuation: inventoryService.stockValuation(ingredients),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const auth = await requireAdminRestaurantFeature("INVENTORY");
  if (!auth.ok) return auth.response;
  try {
    const parsed = stockAdjustSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const actor = {
      role: "RESTAURANT_ADMIN" as const,
      id: auth.accountId,
      email: auth.email,
      name: auth.email,
    };
    if (parsed.data.kind === "RECONCILIATION" && parsed.data.countedQuantity != null) {
      const data = await inventoryService.reconcileToCounted(
        auth.restaurantId,
        parsed.data.ingredientId,
        parsed.data.countedQuantity,
        actor,
      );
      return NextResponse.json({ success: true, data });
    }
    const data = await inventoryService.adjustStock(auth.restaurantId, {
      ...parsed.data,
      actor,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to adjust stock." }, { status: 500 });
  }
}
