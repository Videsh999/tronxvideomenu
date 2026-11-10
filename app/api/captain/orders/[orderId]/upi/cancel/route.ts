import { NextResponse } from "next/server";
import { requireCaptain, unauthorizedResponse } from "@/lib/auth-server";
import { cancelDynamicUpiRequest, getDynamicUpiRequest } from "@/lib/payments/dynamic-payment.service";
import { orderService } from "@/lib/services/order.service";
import { captainService } from "@/lib/services/captain.service";

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await requireCaptain("ORDER_MANAGEMENT");
  if (!auth.captain) return unauthorizedResponse();
  const { orderId } = await params;
  const order = await orderService.getForRestaurant(auth.captain.restaurantId, orderId);
  if (!order?.tableId) return NextResponse.json({ success: false, error: "Table order not found." }, { status: 404 });
  try { await captainService.assertCaptainMayServeTable(auth.captain.id, auth.captain.restaurantId, order.tableId); }
  catch { return NextResponse.json({ success: false, error: "This table is not assigned to you." }, { status: 403 }); }
  const payment = await getDynamicUpiRequest(auth.captain.restaurantId, orderId);
  if (!payment || payment.orderId !== orderId) return NextResponse.json({ success: false, error: "Payment request not found." }, { status: 404 });
  try {
    return NextResponse.json({ success: true, data: await cancelDynamicUpiRequest(payment) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to cancel payment request." }, { status: 409 });
  }
}
