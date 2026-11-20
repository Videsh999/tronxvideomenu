import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { hasRestaurantFeature } from "@/lib/features";
import { restaurantService } from "@/lib/services/restaurant.service";

const settingsSchema = z
  .object({
    qrRequiresCaptainApproval: z.boolean().optional(),
    customerOrderingMode: z.enum(["OFF", "CAPTAIN_APPROVAL", "AUTOMATIC"]).optional(),
    internalTrackingEnabled: z.boolean().optional(),
  })
  .strict();

export async function PATCH(request: Request) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const input = settingsSchema.parse(await request.json());
    const existing = await restaurantService.getById(admin.restaurantId);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
    }

    if (input.internalTrackingEnabled !== undefined && !hasRestaurantFeature(existing, "INTERNAL_TRACKING")) {
      return NextResponse.json(
        { success: false, error: "Internal tracking is not enabled for this restaurant." },
        { status: 403 },
      );
    }

    const nextOrderSettings = {
      ...(existing.orderSettings ?? {}),
      ...(input.customerOrderingMode
        ? {
            customerOrderingMode: input.customerOrderingMode,
            qrRequiresCaptainApproval: input.customerOrderingMode === "CAPTAIN_APPROVAL",
          }
        : {}),
      ...(input.qrRequiresCaptainApproval !== undefined
        ? { qrRequiresCaptainApproval: input.qrRequiresCaptainApproval }
        : {}),
      ...(input.internalTrackingEnabled !== undefined
        ? { internalTrackingEnabled: input.internalTrackingEnabled }
        : {}),
    };

    const restaurant = await restaurantService.update(admin.restaurantId, {
      orderSettings: nextOrderSettings,
    });
    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: restaurant.orderSettings });
  } catch (error) {
    const validation = error && typeof error === "object" && "issues" in error;
    return NextResponse.json(
      {
        success: false,
        error: validation ? "Invalid order approval setting." : "Unable to update order approval setting.",
      },
      { status: validation ? 400 : 500 },
    );
  }
}
