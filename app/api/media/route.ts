import { NextResponse } from "next/server";
import { mediaService } from "@/lib/services/media.service";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;

    const restaurant = await restaurantService.getById(admin.restaurantId);
    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurant not found" },
        { status: 404 },
      );
    }

    const featureCheck = requireRestaurantFeature(restaurant, "MEDIA_LIBRARY");
    if (!featureCheck.allowed) {
      return NextResponse.json(
        { success: false, error: featureCheck.reason },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("restaurantId") || admin.restaurantId;
    if (restaurantId !== admin.restaurantId) {
      return NextResponse.json(
        { success: false, error: "Restaurant not found" },
        { status: 404 },
      );
    }
    const media = await mediaService.getByRestaurantId(admin.restaurantId);

    return NextResponse.json({ success: true, data: media });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch media";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
