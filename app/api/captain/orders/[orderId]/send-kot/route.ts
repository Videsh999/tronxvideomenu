import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import { captainService } from "@/lib/services/captain.service";

export async function POST(_request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const auth = await requireCaptain("ORDER_MANAGEMENT");
  if (auth.error) return auth.error;
  try {
    const { orderId } = await params;
    const current = await orderService.getForRestaurant(auth.captain.restaurantId, orderId);
    if (!current?.tableId) return NextResponse.json({ success: false, error: "Table order not found." }, { status: 404 });
    try {
      await captainService.assertCaptainMayServeTable(auth.captain.id, auth.captain.restaurantId, current.tableId);
    } catch {
      return NextResponse.json({ success: false, error: "This table is not assigned to you." }, { status: 403 });
    }
    const actor = { role: "CAPTAIN" as const, id: auth.captain.id, email: auth.captain.email, name: auth.captain.name };
    const order = await orderService.sendKot(auth.captain.restaurantId, orderId, actor);
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    const status = error instanceof OrderServiceError ? error.statusCode : 500;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unable to send KOT." }, { status });
  }
}
