import { NextResponse } from "next/server";
import { requireCaptain, unauthorizedResponse } from "@/lib/auth-server";
import { restaurantService } from "@/lib/services/restaurant.service";
import { orderService } from "@/lib/services/order.service";
import { createDynamicUpiRequest } from "@/lib/payments/dynamic-payment.service";
import { captainService } from "@/lib/services/captain.service";
import { resolveCaptainPermissions } from "@/lib/captain-permissions";

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await requireCaptain("ORDER_MANAGEMENT");
  if (!auth.captain) return unauthorizedResponse();
  try {
    const { orderId } = await params;
    const restaurant = await restaurantService.getById(auth.captain.restaurantId);
    const order = await orderService.getForRestaurant(auth.captain.restaurantId, orderId);
    if (!restaurant || !order) return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
    if (!resolveCaptainPermissions(auth.captain).recordUpiPayment) return NextResponse.json({ success: false, error: "UPI payment permission is required." }, { status: 403 });
    if (!order.tableId) return NextResponse.json({ success: false, error: "Table order not found." }, { status: 404 });
    try { await captainService.assertCaptainMayServeTable(auth.captain.id, auth.captain.restaurantId, order.tableId); }
    catch { return NextResponse.json({ success: false, error: "This table is not assigned to you." }, { status: 403 }); }
    const request = await createDynamicUpiRequest({ restaurant, order, actor: { role: "CAPTAIN", id: auth.captain.id, email: auth.captain.email, name: auth.captain.name } });
    return NextResponse.json({ success: true, data: request });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to create UPI request." }, { status: 409 });
  }
}
