import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { inventoryService, InventoryServiceError } from "@/lib/services/inventory.service";
import { updateIngredientSchema } from "@/lib/validations";

type Ctx = { params: Promise<{ ingredientId: string }> };

export async function PATCH(request: Request, { params }: Ctx) {
  const { ingredientId } = await params;
  const body = await request.json();
  const auth = await requireOutletPermission({
    feature: "INVENTORY",
    permission: "OUTLET_INVENTORY_WRITE",
    requestedOutletId: typeof body?.outletId === "string" ? body.outletId : undefined,
  });
  if (!auth.ok) return auth.response;

  try {
    const parsed = updateIngredientSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = await inventoryService.updateIngredient(auth.restaurantId, ingredientId, {
      ...parsed.data,
      conversions: parsed.data.conversions as never,
    });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to update ingredient." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { ingredientId } = await params;
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await requireOutletPermission({
    feature: "INVENTORY",
    permission: "OUTLET_INVENTORY_WRITE",
    requestedOutletId: outletId,
  });
  if (!auth.ok) return auth.response;

  try {
    const data = await inventoryService.deactivateIngredient(auth.restaurantId, ingredientId);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof InventoryServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to archive ingredient." }, { status: 500 });
  }
}
