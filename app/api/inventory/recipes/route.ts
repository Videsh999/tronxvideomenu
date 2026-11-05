import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import { inventoryService, InventoryServiceError } from "@/lib/services/inventory.service";
import { upsertRecipeSchema } from "@/lib/validations";

export async function GET() {
  const auth = await requireAdminRestaurantFeature("INVENTORY");
  if (!auth.ok) return auth.response;
  const data = await inventoryService.listRecipes(auth.restaurantId);
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdminRestaurantFeature("INVENTORY");
  if (!auth.ok) return auth.response;
  try {
    const parsed = upsertRecipeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = await inventoryService.upsertRecipe(auth.restaurantId, parsed.data);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to save recipe." }, { status: 500 });
  }
}
