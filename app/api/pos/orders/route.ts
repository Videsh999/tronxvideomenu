import { NextResponse } from "next/server";
import {
  requireRestaurantAdmin,
  requireCaptain,
  unauthorizedResponse,
} from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { placePosOrderSchema } from "@/lib/validations";
import { captainService } from "@/lib/services/captain.service";
import type { PaymentAuditActor } from "@/types";

export async function POST(request: Request) {
  try {
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
    const feature = requireRestaurantFeature(restaurant, "POS");
    if (!feature.allowed) {
      return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
    }

    const body = await request.json();
    const parsed = placePosOrderSchema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const message =
        typeof first?.message === "string" && first.message.trim()
          ? first.message
          : "Validation failed";
      return NextResponse.json(
        { success: false, error: message, details: parsed.error.issues },
        { status: 400 },
      );
    }

    if (captainResult?.captain && parsed.data.channel === "POS_DINE_IN") {
      if (!parsed.data.tableId) return NextResponse.json({ success: false, error: "Select a table or room." }, { status: 400 });
      try {
        await captainService.assertCaptainMayServeTable(captainResult.captain.id, restaurantId, parsed.data.tableId);
      } catch {
        return NextResponse.json({ success: false, error: "This location is unavailable." }, { status: 403 });
      }
    }

    const order = await orderService.createPosOrder(
      restaurantId,
      restaurant.slug,
      parsed.data,
      actor,
    );
    const sent = new Set(order.kotLineIds ?? []);
    const hasNewItems = order.items.some((item) => item.lineId && !sent.has(item.lineId));
    const readyOrder = hasNewItems ? await orderService.sendKot(restaurantId, order.id, actor) : order;
    return NextResponse.json({ success: true, data: readyOrder }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to create POS order." },
      { status: 500 },
    );
  }
}
