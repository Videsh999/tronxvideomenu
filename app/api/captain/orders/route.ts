import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import { captainService } from "@/lib/services/captain.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { placeCaptainOrderSchema } from "@/lib/validations";

export async function GET() {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;
  try {
    return NextResponse.json({ success: true, data: await orderService.listForRestaurant(captain.restaurantId) });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load orders" }, { status: 500 });
  }
}

/**
 * Captain walk-in order — same pricing/validation as POS via createPosOrder.
 * No phone required. Table must be assigned to this captain.
 */
export async function POST(request: Request) {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;

  try {
    const restaurant = await restaurantService.getById(captain.restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
    }
    const feature = requireRestaurantFeature(restaurant, "CAPTAIN_ACCESS");
    if (!feature.allowed) {
      return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
    }

    const parsed = placeCaptainOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        {
          success: false,
          error: typeof first?.message === "string" ? first.message : "Validation failed",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const table = await tableRepository.findByRestaurantAndNumber(
      captain.restaurantId,
      parsed.data.tableNumber,
    );
    if (!table || !table.isActive || table.status === "CLOSED") {
      return NextResponse.json({ success: false, error: "Selected table is unavailable." }, { status: 400 });
    }

    try {
      await captainService.assertCaptainMayServeTable(captain.id, captain.restaurantId, table.id);
    } catch (authError) {
      return NextResponse.json(
        { success: false, error: authError instanceof Error ? authError.message : "Not authorized for this table." },
        { status: 403 },
      );
    }

    const noteParts = [
      parsed.data.orderNote?.trim(),
      parsed.data.guestName?.trim() ? `Guest: ${parsed.data.guestName.trim()}` : null,
    ].filter(Boolean);

    const actor = {
      role: "CAPTAIN" as const,
      id: captain.id,
      email: captain.email,
      name: captain.name,
    };

    const active = await orderService.findActiveForTable(
      captain.restaurantId,
      parsed.data.tableNumber,
    );

    let order;
    let appended = false;
    if (active && !["SERVED"].includes(active.status)) {
      order = await orderService.appendItemsToOrder(
        captain.restaurantId,
        restaurant.slug,
        active.id,
        {
          items: parsed.data.items,
          idempotencyKey: parsed.data.idempotencyKey,
          orderNote: noteParts.length ? noteParts.join(" · ") : undefined,
        },
        actor,
      );
      appended = true;
    } else {
      order = await orderService.createPosOrder(
        captain.restaurantId,
        restaurant.slug,
        {
          channel: "POS_DINE_IN",
          tableNumber: parsed.data.tableNumber,
          guestCount: parsed.data.guestCount,
          orderNote: noteParts.length ? noteParts.join(" · ") : undefined,
          customerPhone: parsed.data.customerPhone,
          idempotencyKey: parsed.data.idempotencyKey,
          items: parsed.data.items,
        },
        actor,
      );
    }

    let kitchenWarning: string | undefined;
    let sentToKitchen = false;
    if (parsed.data.sendToKitchen !== false) {
      try {
        if (order.status === "PENDING") {
          const advanced = await orderService.updateStatus(
            captain.restaurantId,
            order.id,
            "PREPARING",
            actor,
          );
          if (advanced) {
            order = advanced;
            sentToKitchen = true;
          } else {
            kitchenWarning =
              "Order saved but kitchen handoff could not be confirmed — accept from Orders.";
          }
        } else if (appended && ["ACCEPTED", "PREPARING", "READY"].includes(order.status)) {
          sentToKitchen = true;
        }
      } catch (kitchenError) {
        kitchenWarning =
          kitchenError instanceof Error
            ? kitchenError.message
            : "Order saved but kitchen handoff failed — accept from Orders.";
      }
    }

    return NextResponse.json(
      {
        success: true,
        data: order,
        meta: { sentToKitchen, appended, warning: kitchenWarning },
      },
      { status: 201 },
    );
  } catch (cause) {
    if (cause instanceof OrderServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json(
      { success: false, error: cause instanceof Error ? cause.message : "Unable to place order." },
      { status: 500 },
    );
  }
}
