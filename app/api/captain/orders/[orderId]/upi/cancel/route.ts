import { NextResponse } from "next/server";
import { requireCaptain, unauthorizedResponse } from "@/lib/auth-server";
import { cancelDynamicUpiRequest, getDynamicUpiRequest } from "@/lib/payments/dynamic-payment.service";

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await requireCaptain("ORDER_MANAGEMENT");
  if (!auth.captain) return unauthorizedResponse();
  const { orderId } = await params;
  const payment = await getDynamicUpiRequest(auth.captain.restaurantId, orderId);
  if (!payment) return NextResponse.json({ success: false, error: "Payment request not found." }, { status: 404 });
  try {
    return NextResponse.json({ success: true, data: await cancelDynamicUpiRequest(payment) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to cancel payment request." }, { status: 409 });
  }
}
