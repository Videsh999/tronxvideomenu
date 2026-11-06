import { NextResponse } from "next/server";
import { z } from "zod";
import {
  customerLoyaltyService,
  CustomerLoyaltyServiceError,
} from "@/lib/services/customer-loyalty.service";

const schema = z
  .object({
    restaurantSlug: z.string().trim().min(1).max(120),
    token: z.string().trim().min(20).max(200),
    password: z.string().min(8).max(256),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    await customerLoyaltyService.resetPassword(input);
    return NextResponse.json({ success: true, data: { ok: true } });
  } catch (error) {
    if (error instanceof CustomerLoyaltyServiceError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to reset password" }, { status: 400 });
  }
}
