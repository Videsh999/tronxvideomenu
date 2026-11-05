import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { inventoryService, InventoryServiceError } from "@/lib/services/inventory.service";
import { createIngredientSchema } from "@/lib/validations";

export async function GET(request: Request) {
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await requireOutletPermission({
    feature: "INVENTORY",
    permission: "OUTLET_INVENTORY_READ",
    requestedOutletId: outletId ?? undefined,
  });
  if (!auth.ok) return auth.response;
  const data = await inventoryService.listIngredients(auth.restaurantId);
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json();
  const auth = await requireOutletPermission({
    feature: "INVENTORY",
    permission: "OUTLET_INVENTORY_WRITE",
    requestedOutletId: typeof body?.outletId === "string" ? body.outletId : undefined,
  });
  if (!auth.ok) return auth.response;
  try {
    const parsed = createIngredientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = await inventoryService.createIngredient(auth.restaurantId, {
      ...parsed.data,
      organizationId: auth.restaurant.organizationId,
      conversions: parsed.data.conversions as never,
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to create ingredient." }, { status: 500 });
  }
}
