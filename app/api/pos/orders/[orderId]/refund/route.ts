import { NextResponse } from "next/server";
import { requireRestaurantAdmin, unauthorizedResponse } from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { refundPaymentSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { orderId } = await params;
    const { admin, error } = await requireRestaurantAdmin();
    if (error || !admin) return unauthorizedResponse();

    const restaurant = await restaurantService.getById(admin.restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
    }
    const feature = requireRestaurantFeature(restaurant, "POS");
    if (!feature.allowed) {
      return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
    }

    const body = await request.json();
    const parsed = refundPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const updated = await orderService.refundPayment(
      admin.restaurantId,
      orderId,
      parsed.data,
      {
        role: "RESTAURANT_ADMIN",
        id: admin.restaurantAdminAccountId ?? admin.email,
        email: admin.email,
        name: admin.email,
      },
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json({ success: false, error: "Unable to process refund." }, { status: 500 });
  }
}
