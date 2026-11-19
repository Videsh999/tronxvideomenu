import { NextResponse } from "next/server";
import { requireCaptain, requireRestaurantAdmin, unauthorizedResponse } from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ orderId: string }> };

/**
 * Idempotent retry for inventory restores left PENDING or FAILED after a line cancel.
 * The bill write is already committed. This does not cancel lines again.
 */
export async function POST(_request: Request, context: Context) {
  const adminResult = await requireRestaurantAdmin();
  const captainResult = !adminResult.admin ? await requireCaptain("ORDER_MANAGEMENT") : null;
  const restaurantId = adminResult.admin?.restaurantId ?? captainResult?.captain?.restaurantId;
  if (!restaurantId) return adminResult.error ?? captainResult?.error ?? unauthorizedResponse();

  const { orderId } = await context.params;
  try {
    const data = await orderService.retryInventoryRestores(restaurantId, orderId);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof OrderServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to retry inventory restore." }, { status: 500 });
  }
}
