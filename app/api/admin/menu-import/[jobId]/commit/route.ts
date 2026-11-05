import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { restaurantService } from "@/lib/services/restaurant.service";
import { menuImportService } from "@/lib/services/menu-import.service";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const restaurant = await restaurantService.getById(admin.restaurantId);
    if (!restaurant) return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404, headers: noStore });
    const feature = requireRestaurantFeature(restaurant, "MENU_IMPORT");
    if (!feature.allowed) return NextResponse.json({ success: false, error: feature.reason }, { status: 403, headers: noStore });
    const { jobId } = await params;
    const job = await menuImportService.commit(admin.restaurantId, jobId);
    return NextResponse.json({ success: true, data: job }, { headers: noStore });
  } catch (cause) {
    return NextResponse.json(
      { success: false, error: cause instanceof Error ? cause.message : "Unable to commit import." },
      { status: 400, headers: noStore },
    );
  }
}
