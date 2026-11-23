import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import { menuOfferService, MenuOfferServiceError } from "@/lib/services/menu-offer.service";
import { createMenuOfferSchema } from "@/lib/validations";

export async function GET() {
  const auth = await requireAdminRestaurantFeature("MENU_OFFERS");
  if (!auth.ok) return auth.response;
  const data = await menuOfferService.list(auth.restaurantId);
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdminRestaurantFeature("MENU_OFFERS");
  if (!auth.ok) return auth.response;
  const parsed = createMenuOfferSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const data = await menuOfferService.create(auth.restaurantId, parsed.data);
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    if (error instanceof MenuOfferServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
