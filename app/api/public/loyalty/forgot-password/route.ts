import { NextResponse } from "next/server";
import { z } from "zod";
import {
  customerLoyaltyService,
  CustomerLoyaltyServiceError,
} from "@/lib/services/customer-loyalty.service";

const schema = z
  .object({
    restaurantSlug: z.string().trim().min(1).max(120),
    email: z.string().trim().email().max(254),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const result = await customerLoyaltyService.requestPasswordReset({
      ...input,
      requestUrl: request.url,
    });

    const message = result.emailSent
      ? "If an account exists for that email, a reset link is on its way. Check your inbox and spam folder."
      : result.mailConfigured
        ? "If an account exists for that email, a reset link was prepared. Delivery may be delayed — try again shortly or contact the restaurant."
        : "If an account exists for that email, a reset link is ready below. Email delivery is not configured on this server yet.";

    return NextResponse.json({
      success: true,
      data: {
        message,
        emailSent: result.emailSent,
        resetPath: result.resetPath,
      },
    });
  } catch (error) {
    if (error instanceof CustomerLoyaltyServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to start reset" }, { status: 400 });
  }
}
