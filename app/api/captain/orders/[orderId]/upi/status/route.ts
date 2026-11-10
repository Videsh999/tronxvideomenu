import { NextResponse } from "next/server";
import { requireCaptain, unauthorizedResponse } from "@/lib/auth-server";
import { getDynamicUpiRequest, refreshDynamicUpiRequest } from "@/lib/payments/dynamic-payment.service";

export async function GET(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await requireCaptain("ORDER_MANAGEMENT");
  if (!auth.captain) return unauthorizedResponse();
  const { orderId } = await params;
  const request = await getDynamicUpiRequest(auth.captain.restaurantId, orderId);
  if (!request) return NextResponse.json({ success: false, error: "Payment request not found." }, { status: 404 });
  try {
    const actor = { role: "CAPTAIN" as const, id: auth.captain.id, email: auth.captain.email, name: auth.captain.name };
    const refreshed = await refreshDynamicUpiRequest(request, actor);
    return NextResponse.json({ success: true, data: refreshed });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to refresh payment status." }, { status: 502 });
  }
}
