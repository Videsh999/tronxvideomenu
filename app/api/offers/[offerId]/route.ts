import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import { menuOfferService, MenuOfferServiceError } from "@/lib/services/menu-offer.service";
import { updateMenuOfferSchema } from "@/lib/validations";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const auth = await requireAdminRestaurantFeature("MENU_OFFERS");
  if (!auth.ok) return auth.response;
  const { offerId } = await params;
  const parsed = updateMenuOfferSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  try {
    const data = await menuOfferService.update(auth.restaurantId, offerId, parsed.data);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof MenuOfferServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ offerId: string }> },
) {
  const auth = await requireAdminRestaurantFeature("MENU_OFFERS");
  if (!auth.ok) return auth.response;
  const { offerId } = await params;
  try {
    await menuOfferService.remove(auth.restaurantId, offerId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof MenuOfferServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
