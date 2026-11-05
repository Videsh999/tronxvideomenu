import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import { procurementService } from "@/lib/services/procurement.service";
import { createSupplierSchema } from "@/lib/validations";

export async function GET() {
  const auth = await requireAdminRestaurantFeature("PROCUREMENT");
  if (!auth.ok) return auth.response;
  const data = await procurementService.listSuppliers(auth.restaurantId);
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdminRestaurantFeature("PROCUREMENT");
  if (!auth.ok) return auth.response;
  const parsed = createSupplierSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = await procurementService.createSupplier(auth.restaurantId, {
    ...parsed.data,
    email: parsed.data.email || undefined,
    organizationId: auth.restaurant.organizationId,
  });
  return NextResponse.json({ success: true, data }, { status: 201 });
}
