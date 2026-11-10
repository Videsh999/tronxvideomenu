import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import { captainService } from "@/lib/services/captain.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { placeCaptainOrderSchema } from "@/lib/validations";
import {
  assertCaptainDiscountAllowed,
  resolveCaptainPermissions,
} from "@/lib/captain-permissions";
import { lineItemTotal } from "@/lib/order-pricing";

export async function GET() {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;
  try {
    const assigned = new Set(captain.assignedTableIds ?? []);
    const orders = await orderService.listForRestaurant(captain.restaurantId);
    const scoped = orders.filter((order) => assigned.has(order.tableId));
    return NextResponse.json({ success: true, data: scoped });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load orders" }, { status: 500 });
  }
}

/**
 * Captain walk-in / floor POS order — same pricing path as admin POS via createPosOrder.
 * Captain confirmation is authorization (CAPTAIN_DIRECT → CAPTAIN_APPROVED). No second approval.
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

    const permissions = resolveCaptainPermissions(captain);
    if (parsed.data.couponCode && !permissions.applyCoupon) {
      return NextResponse.json(
        { success: false, error: "This captain is not permitted to apply coupons." },
        { status: 403 },
      );
    }

    const menu = await restaurantService.getFullMenu(restaurant.slug);
    if (!menu || menu.restaurant.id !== captain.restaurantId) {
      return NextResponse.json({ success: false, error: "Menu unavailable." }, { status: 404 });
    }

    let estimatedSubtotal = 0;
    for (const requested of parsed.data.items) {
      const dish = menu.dishes.find((entry) => entry.id === requested.dishId);
      if (!dish) continue;
      let unit = dish.price;
      if (requested.variantId) {
        const variant = (dish.variants ?? []).find((entry) => entry.id === requested.variantId);
        if (variant) unit = variant.price;
      }
      const addonTotals: number[] = [];
      for (const selection of requested.selections ?? []) {
        const group = (dish.addonGroups ?? []).find((entry) => entry.id === selection.groupId);
        for (const addonRef of selection.addons ?? []) {
          const addon = group?.addons.find((entry) => entry.id === addonRef.addonId);
          if (addon) addonTotals.push(addon.price);
        }
      }
      estimatedSubtotal += lineItemTotal({
        unitPrice: unit,
        quantity: requested.quantity,
        addonTotals,
        itemDiscountAmount: requested.itemDiscountAmount ?? 0,
      });
    }

    try {
      assertCaptainDiscountAllowed(
        permissions,
        parsed.data.billDiscountAmount ?? 0,
        estimatedSubtotal,
      );
    } catch (permissionError) {
      return NextResponse.json(
        {
          success: false,
          error: permissionError instanceof Error ? permissionError.message : "Discount not allowed.",
        },
        { status: 403 },
      );
    }

    const table = await tableRepository.findByRestaurantAndId(captain.restaurantId, parsed.data.tableId);
    if (table && table.tableNumber !== parsed.data.tableNumber) return NextResponse.json({ success: false, error: "Selected location changed. Refresh and try again." }, { status: 409 });
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

    const order = await orderService.createPosOrder(
        captain.restaurantId,
        restaurant.slug,
        {
          channel: "POS_DINE_IN",
          tableId: table.id,
          tableNumber: parsed.data.tableNumber,
          guestCount: parsed.data.guestCount,
          orderNote: noteParts.length ? noteParts.join(" · ") : undefined,
          customerPhone: parsed.data.customerPhone,
          billDiscountAmount: parsed.data.billDiscountAmount,
          couponCode: parsed.data.couponCode,
          redeemLoyaltyPoints: parsed.data.redeemLoyaltyPoints,
          idempotencyKey: parsed.data.idempotencyKey,
          items: parsed.data.items,
        },
        actor,
      );

    return NextResponse.json(
      {
        success: true,
        data: order,
        meta: { sentToKitchen: false, appended: false, source: "CAPTAIN_DIRECT", tableSessionId: order.tableSessionId },
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
