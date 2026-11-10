import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await requireCaptain("ORDER_MANAGEMENT");
  if (auth.error) return auth.error;
  try {
    const { orderId } = await params;
    const actor = { role: "CAPTAIN" as const, id: auth.captain.id, email: auth.captain.email, name: auth.captain.name };
    const order = await orderService.sendKot(auth.captain.restaurantId, orderId, actor);
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    const status = error instanceof OrderServiceError ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to send KOT." }, { status });
  }
}
