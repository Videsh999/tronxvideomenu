import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { captainService } from "@/lib/services/captain.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { assignCaptainTablesSchema } from "@/lib/validations";

export async function PUT(request: Request, context: { params: Promise<{ captainId: string }> }) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error) return error;
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) return NextResponse.json({ success: false, error: "Restaurant not found" }, { status: 404 });
  const feature = requireRestaurantFeature(restaurant, "CAPTAIN_ACCESS");
  if (!feature.allowed) return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });

  try {
    const { captainId } = await context.params;
    const body = assignCaptainTablesSchema.parse(await request.json());
    const captain = await captainService.assignTables(
      admin.restaurantId,
      captainId,
      body.tableIds,
      {
        role: "RESTAURANT_ADMIN",
        id: admin.restaurantAdminAccountId ?? admin.email,
        email: admin.email,
      },
      body.note,
    );
    return NextResponse.json({ success: true, data: captain });
  } catch (cause) {
    return NextResponse.json(
      { success: false, error: cause instanceof Error ? cause.message : "Unable to assign tables" },
      { status: 400 },
    );
  }
}
