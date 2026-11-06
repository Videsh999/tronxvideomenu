import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CUSTOMER_SESSION_COOKIE, readCustomerSession } from "@/lib/customer-auth";
import { customerLoyaltyService } from "@/lib/services/customer-loyalty.service";

export async function GET() {
  const secret = process.env.AUTH_SECRET;
  const cookieStore = await cookies();
  const session = await readCustomerSession(cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value, secret);
  if (!session) {
    return NextResponse.json({ success: true, data: null });
  }
  const customer = await customerLoyaltyService.getView(session.restaurantId, session.customerId);
  if (!customer) {
    return NextResponse.json({ success: true, data: null });
  }
  return NextResponse.json({
    success: true,
    data: {
      customer,
      restaurantSlug: session.restaurantSlug,
    },
  });
}
