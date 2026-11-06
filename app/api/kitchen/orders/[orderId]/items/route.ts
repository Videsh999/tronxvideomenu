import { NextResponse } from "next/server";
import {
  requireRestaurantAdmin,
  requireCaptain,
  unauthorizedResponse,
} from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { kitchenItemPrepSchema } from "@/lib/validations";
import type { PaymentAuditActor } from "@/types";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { orderId } = await params;
    const adminResult = await requireRestaurantAdmin();
    const captainResult = !adminResult.admin ? await requireCaptain("ORDER_MANAGEMENT") : null;
    if (!adminResult.admin && !captainResult?.captain) return unauthorizedResponse();

    let restaurantId: string;
    let actor: PaymentAuditActor;
    if (adminResult.admin) {
      restaurantId = adminResult.admin.restaurantId;
      actor = {
        role: "RESTAURANT_ADMIN",
        id: adminResult.admin.restaurantAdminAccountId ?? adminResult.admin.email,
        email: adminResult.admin.email,
        name: adminResult.admin.email,
      };
    } else {
      restaurantId = captainResult!.captain!.restaurantId;
      actor = {
        role: "CAPTAIN",
        id: captainResult!.captain!.id,
        email: captainResult!.captain!.email,
        name: captainResult!.captain!.name,
      };
    }

    const restaurant = await restaurantService.getById(restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
    }
    // Captains operate via ORDER_MANAGEMENT; admin KDS via KITCHEN_DISPLAY.
    const feature = captainResult?.captain
      ? requireRestaurantFeature(restaurant, "ORDER_MANAGEMENT")
      : requireRestaurantFeature(restaurant, "KITCHEN_DISPLAY");
    if (!feature.allowed) {
      return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
    }

    const body = await request.json();
    const parsed = kitchenItemPrepSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }

    if (captainResult?.captain) {
      const order = await orderService.getForRestaurant(restaurantId, orderId);
      if (!order) {
        return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
      }
      if (order.tableId) {
        const { captainService } = await import("@/lib/services/captain.service");
        try {
          await captainService.assertCaptainMayServeTable(
            captainResult.captain.id,
            restaurantId,
            order.tableId,
          );
        } catch (authError) {
          return NextResponse.json(
            {
              success: false,
              error: authError instanceof Error ? authError.message : "Not authorized for this table.",
            },
            { status: 403 },
          );
        }
      }
    }

    const updated = await orderService.updateItemPreparation(
      restaurantId,
      orderId,
      parsed.data.lineId,
      parsed.data.preparationStatus,
      actor,
    );
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to update kitchen item." },
      { status: 500 },
    );
  }
}
