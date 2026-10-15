import { NextResponse } from "next/server";
import {
  requireRestaurantAdmin,
  requireCaptain,
  unauthorizedResponse,
  forbiddenResponse,
} from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import {
  recordPaymentSchema,
  correctPaymentSchema,
} from "@/lib/validations";
import type { PaymentAuditActor } from "@/types";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { orderId } = await params;
    const body = await request.json();

    // Authenticate: either Restaurant Admin or Captain
    const adminResult = await requireRestaurantAdmin();
    const captainResult = !adminResult.admin ? await requireCaptain("ORDER_MANAGEMENT") : null;

    if (!adminResult.admin && !captainResult?.captain) {
      return unauthorizedResponse();
    }

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
    } else if (captainResult?.captain) {
      restaurantId = captainResult.captain.restaurantId;
      actor = {
        role: "CAPTAIN",
        id: captainResult.captain.id,
        email: captainResult.captain.email,
        name: captainResult.captain.name,
      };
    } else {
      return unauthorizedResponse();
    }

    // Verify feature entitlement
    const restaurant = await restaurantService.getById(restaurantId);
    if (!restaurant) {
      return NextResponse.json(
        { success: false, error: "Restaurant not found." },
        { status: 404 },
      );
    }
    const featureCheck = requireRestaurantFeature(restaurant, "ORDER_MANAGEMENT");
    if (!featureCheck.allowed) {
      return NextResponse.json(
        { success: false, error: featureCheck.reason },
        { status: 403 },
      );
    }

    // Is this a correction/reversal request or an initial record request?
    if ("action" in body) {
      // Corrections and reversals are RESTRICTED to Restaurant Admin
      if (actor.role !== "RESTAURANT_ADMIN") {
        return forbiddenResponse();
      }
      const parsed = correctPaymentSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          {
            success: false,
            error: "Validation failed",
            details: parsed.error.issues,
          },
          { status: 400 },
        );
      }
      const updated = await orderService.correctPayment(
        restaurantId,
        orderId,
        parsed.data,
        actor,
      );
      return NextResponse.json({ success: true, data: updated });
    }

    // Initial record payment
    const parsed = recordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: parsed.error.issues,
        },
        { status: 400 },
      );
    }

    const updated = await orderService.recordPayment(
      restaurantId,
      orderId,
      parsed.data.method,
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
    const message =
      error instanceof Error ? error.message : "Unable to process payment.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
