import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_TTL_SECONDS,
  createCustomerSession,
} from "@/lib/customer-auth";
import { isSecureRequest } from "@/lib/auth-core";
import {
  customerLoyaltyService,
  CustomerLoyaltyServiceError,
} from "@/lib/services/customer-loyalty.service";

const schema = z
  .object({
    restaurantSlug: z.string().trim().min(1).max(120),
    name: z.string().trim().min(2).max(80),
    phone: z.string().trim().min(7).max(24),
    email: z.string().trim().email().max(254),
    password: z.string().min(8).max(256),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const secret = process.env.AUTH_SECRET;
    if (!secret) {
      return NextResponse.json({ success: false, error: "Auth not configured" }, { status: 503 });
    }
    const input = schema.parse(await request.json());
    const result = await customerLoyaltyService.register(input);
    const session = await createCustomerSession(
      {
        customerId: result.customer.id,
        restaurantId: result.restaurant.id,
        restaurantSlug: result.restaurant.slug,
        phone: result.customer.phone,
      },
      secret,
    );
    const response = NextResponse.json({ success: true, data: result });
    response.cookies.set({
      name: CUSTOMER_SESSION_COOKIE,
      value: session,
      httpOnly: true,
      secure: isSecureRequest(request),
      sameSite: "lax",
      path: "/",
      maxAge: CUSTOMER_SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    if (error instanceof CustomerLoyaltyServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    const validation = error && typeof error === "object" && "issues" in error;
    return NextResponse.json(
      { success: false, error: validation ? "Invalid details" : "Unable to register" },
      { status: validation ? 400 : 500 },
    );
  }
}
