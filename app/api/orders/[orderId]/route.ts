import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRestaurantAdmin } from "@/lib/auth-server";
import { orderRepository } from "@/lib/repositories/order.repository";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { sessionOwnsOutlet } from "@/lib/security/outlet-scope";

const statusSchema = z.object({
  status: z.enum([
    "ACCEPTED",
    "PREPARING",
    "READY",
    "SERVED",
    "COMPLETED",
    "CANCELLED",
    "REJECTED",
  ]),
});
type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
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

    const featureCheck = requireRestaurantFeature(
      restaurant,
      "ORDER_MANAGEMENT",
    );
    if (!featureCheck.allowed) {
      return NextResponse.json(
        { success: false, error: featureCheck.reason },
        { status: 403 },
      );
    }

    const { orderId } = await params;
    const order = await orderRepository.findByRestaurantAndId(
      admin.restaurantId,
      orderId,
    );
    if (!order || !sessionOwnsOutlet(admin.restaurantId, order.restaurantId))
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 },
      );
    const {
      customerTokenHash: _tokenHash,
      idempotencyKey: _key,
      ...safeOrder
    } = order;
    return NextResponse.json(
      { success: true, data: safeOrder },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to load order." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
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

    const featureCheck = requireRestaurantFeature(
      restaurant,
      "ORDER_MANAGEMENT",
    );
    if (!featureCheck.allowed) {
      return NextResponse.json(
        { success: false, error: featureCheck.reason },
        { status: 403 },
      );
    }

    const { orderId } = await params;
    const parsed = statusSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { success: false, error: "Invalid order status." },
        { status: 400 },
      );
    const order = await orderService.updateStatus(
      admin.restaurantId,
      orderId,
      parsed.data.status,
    );
    if (!order)
      return NextResponse.json(
        { success: false, error: "Order not found." },
        { status: 404 },
      );
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof OrderServiceError
            ? error.message
            : "Unable to update order status.",
      },
      { status: 409 },
    );
  }
}
