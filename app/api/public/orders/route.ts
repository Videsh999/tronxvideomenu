import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { placeOrderSchema } from "@/lib/validations";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { requireRestaurantFeature } from "@/lib/feature-access";
import { CUSTOMER_SESSION_COOKIE, readCustomerSession } from "@/lib/customer-auth";

export async function POST(request: Request) {
  try {
    const input = placeOrderSchema.parse(await request.json());

    const menu = await restaurantService.getFullMenu(input.slug);
    if (!menu) {
      return NextResponse.json(
        { success: false, error: "Restaurant not found" },
        { status: 404 },
      );
    }

    const featureCheck = requireRestaurantFeature(
      menu.restaurant,
      "TABLE_ORDERING",
    );
    if (!featureCheck.allowed) {
      return NextResponse.json(
        { success: false, error: featureCheck.reason },
        { status: 403 },
      );
    }

    // If guest optionally signed into loyalty for this restaurant, link the order.
    let loyaltyCustomerId: string | undefined;
    const cookieStore = await cookies();
    const session = await readCustomerSession(
      cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value,
      process.env.AUTH_SECRET,
    );
    if (
      session &&
      session.restaurantId === menu.restaurant.id &&
      session.restaurantSlug === menu.restaurant.slug
    ) {
      loyaltyCustomerId = session.customerId;
    }

    const result = await orderService.createPublic(input, { loyaltyCustomerId });
    return NextResponse.json(
      { success: true, data: result },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const validation = error && typeof error === "object" && "issues" in error;
    const duplicate =
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 11000;
    const message =
      error instanceof OrderServiceError
        ? error.message
        : "Unable to place your order. Please try again.";
    return NextResponse.json(
      {
        success: false,
        error: validation
          ? "Your cart is invalid. Please review it."
          : duplicate
            ? "This order was already submitted."
            : message,
      },
      {
        status: validation
          ? 400
          : error instanceof OrderServiceError
            ? error.statusCode
            : duplicate
              ? 409
              : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
