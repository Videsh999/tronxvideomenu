import { NextResponse } from "next/server";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { billingPreviewSchema } from "@/lib/validations";
import { calculateRestaurantBill } from "@/lib/billing/calculate-bill";
import { restaurantService } from "@/lib/services/restaurant.service";

export async function POST(request: Request) {
  const { admin, error } = await requireRestaurantAdmin();
  if (error) return error;

  const parsed = billingPreviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid preview input" }, { status: 400 });
  }

  const restaurant = await restaurantService.getById(admin.restaurantId);
  if (!restaurant) {
    return NextResponse.json({ success: false, error: "Restaurant not found" }, { status: 404 });
  }

  const billing = {
    ...(restaurant.billing ?? {}),
    ...(parsed.data.billing ?? {}),
  };

  const lineTotal = parsed.data.itemPrice * parsed.data.quantity;
  try {
    const bill = calculateRestaurantBill({
      lines: [{ lineTotal, quantity: parsed.data.quantity }],
      billDiscountAmount: parsed.data.billDiscountAmount,
      billing,
      itemCount: 1,
      quantityCount: parsed.data.quantity,
    });
    return NextResponse.json({ success: true, data: bill });
  } catch (cause) {
    return NextResponse.json(
      { success: false, error: cause instanceof Error ? cause.message : "Preview failed" },
      { status: 400 },
    );
  }
}
