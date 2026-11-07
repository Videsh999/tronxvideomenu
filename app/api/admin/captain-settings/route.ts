import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";

const settingsSchema = z.object({
  qrRequiresCaptainApproval: z.boolean(),
}).strict();

export async function PATCH(request: Request) {
  try {
    const { admin, error } = await requireRestaurantAdmin();
    if (error) return error;
    const input = settingsSchema.parse(await request.json());
    const restaurant = await restaurantService.update(admin.restaurantId, {
      orderSettings: input,
    });
    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: restaurant.orderSettings });
  } catch (error) {
    const validation = error && typeof error === "object" && "issues" in error;
    return NextResponse.json(
      { success: false, error: validation ? "Invalid order approval setting." : "Unable to update order approval setting." },
      { status: validation ? 400 : 500 },
    );
  }
}
