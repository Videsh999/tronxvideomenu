import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { captainService } from "@/lib/services/captain.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { updateCaptainSchema } from "@/lib/validations";

export async function PATCH(request: Request, context: { params: Promise<{ captainId: string }> }) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error) return error;
  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) return NextResponse.json({ success: false, error: "Restaurant not found" }, { status: 404 });
  const feature = requireRestaurantFeature(restaurant, "CAPTAIN_ACCESS");
  if (!feature.allowed) return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
  try {
    const input = updateCaptainSchema.parse(await request.json());
    const { captainId } = await context.params;

    let captain = null;
    if (input.name !== undefined || input.employeeCode !== undefined) {
      captain = await captainService.updateProfile(admin.restaurantId, captainId, {
        name: input.name,
        employeeCode: input.employeeCode,
      });
    }
    if (input.isActive !== undefined) {
      captain = await captainService.setActive(admin.restaurantId, captainId, input.isActive);
    }
    return captain
      ? NextResponse.json({ success: true, data: captain })
      : NextResponse.json({ success: false, error: "Captain not found" }, { status: 404 });
  } catch (cause) {
    return NextResponse.json(
      { success: false, error: cause instanceof Error ? cause.message : "Invalid Captain update" },
      { status: 400 },
    );
  }
}
