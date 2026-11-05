import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import {
  procurementService,
  ProcurementServiceError,
} from "@/lib/services/procurement.service";
import { createPurchaseOrderSchema } from "@/lib/validations";

export async function GET() {
  const auth = await requireAdminRestaurantFeature("PROCUREMENT");
  if (!auth.ok) return auth.response;
  const [orders, outstanding, reorder] = await Promise.all([
    procurementService.listPurchaseOrders(auth.restaurantId),
    procurementService.outstandingPurchaseOrders(auth.restaurantId),
    procurementService.reorderSuggestions(auth.restaurantId),
  ]);
  return NextResponse.json(
    { success: true, data: { orders, outstanding, reorder } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const auth = await requireAdminRestaurantFeature("PROCUREMENT");
  if (!auth.ok) return auth.response;
  try {
    const parsed = createPurchaseOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const data = await procurementService.createPurchaseOrder(auth.restaurantId, parsed.data);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof ProcurementServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to create purchase order." }, { status: 500 });
  }
}
