import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import { crmService } from "@/lib/services/crm.service";
import { createCouponSchema } from "@/lib/validations";

export async function GET() {
  const auth = await requireAdminRestaurantFeature("CRM_LOYALTY");
  if (!auth.ok) return auth.response;
  const data = await crmService.listCoupons(auth.restaurantId);
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdminRestaurantFeature("CRM_LOYALTY");
  if (!auth.ok) return auth.response;
  const parsed = createCouponSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const data = await crmService.createCoupon(auth.restaurantId, parsed.data);
  return NextResponse.json({ success: true, data }, { status: 201 });
}
