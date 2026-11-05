import { NextResponse } from "next/server";
import {
  requireRestaurantAdmin,
  requireCaptain,
  unauthorizedResponse,
} from "@/lib/auth-server";
import { posShiftService } from "@/lib/services/pos-shift.service";
import { OrderServiceError } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { openPosShiftSchema, closePosShiftSchema } from "@/lib/validations";
import type { PaymentAuditActor } from "@/types";

async function resolveStaff() {
  const adminResult = await requireRestaurantAdmin();
  const captainResult = !adminResult.admin ? await requireCaptain("ORDER_MANAGEMENT") : null;
  if (!adminResult.admin && !captainResult?.captain) return null;

  if (adminResult.admin) {
    return {
      restaurantId: adminResult.admin.restaurantId,
      actor: {
        role: "RESTAURANT_ADMIN" as const,
        id: adminResult.admin.restaurantAdminAccountId ?? adminResult.admin.email,
        email: adminResult.admin.email,
        name: adminResult.admin.email,
      } satisfies PaymentAuditActor,
    };
  }
  return {
    restaurantId: captainResult!.captain!.restaurantId,
    actor: {
      role: "CAPTAIN" as const,
      id: captainResult!.captain!.id,
      email: captainResult!.captain!.email,
      name: captainResult!.captain!.name,
    } satisfies PaymentAuditActor,
  };
}

export async function GET() {
  try {
    const staff = await resolveStaff();
    if (!staff) return unauthorizedResponse();
    const restaurant = await restaurantService.getById(staff.restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
    }
    const feature = requireRestaurantFeature(restaurant, "POS");
    if (!feature.allowed) {
      return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
    }
    const shift = await posShiftService.getOpen(staff.restaurantId);
    return NextResponse.json(
      { success: true, data: shift },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load shift." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const staff = await resolveStaff();
    if (!staff) return unauthorizedResponse();
    const restaurant = await restaurantService.getById(staff.restaurantId);
    if (!restaurant) {
      return NextResponse.json({ success: false, error: "Restaurant not found." }, { status: 404 });
    }
    const feature = requireRestaurantFeature(restaurant, "POS");
    if (!feature.allowed) {
      return NextResponse.json({ success: false, error: feature.reason }, { status: 403 });
    }

    const body = await request.json();
    if (body?.action === "CLOSE") {
      const parsed = closePosShiftSchema.safeParse({
        closingCashCounted: body.closingCashCounted,
        notes: body.notes,
      });
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: "Validation failed", details: parsed.error.issues },
          { status: 400 },
        );
      }
      const closed = await posShiftService.close(
        staff.restaurantId,
        parsed.data.closingCashCounted,
        staff.actor,
        parsed.data.notes,
      );
      return NextResponse.json({ success: true, data: closed });
    }

    const parsed = openPosShiftSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: parsed.error.issues },
        { status: 400 },
      );
    }
    const opened = await posShiftService.open(
      staff.restaurantId,
      parsed.data.openingFloat,
      staff.actor,
    );
    return NextResponse.json({ success: true, data: opened }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderServiceError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: error.statusCode },
      );
    }
    return NextResponse.json({ success: false, error: "Unable to manage shift." }, { status: 500 });
  }
}
