import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { orderRepository } from "@/lib/repositories/order.repository";
export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain) return error ?? NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const { orderId } = await context.params;
  const order = await orderRepository.findByRestaurantAndId(captain.restaurantId, orderId);
  if (!order) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
  const saved = await orderRepository.appendVersionedEvent(
    captain.restaurantId,
    order.id,
    {
      id: `evt-${crypto.randomUUID()}`,
      type: "KOT_REPRINT",
      at: new Date().toISOString(),
      actor: { role: "CAPTAIN", id: captain.id, name: captain.name },
      message: "KOT reprinted",
      meta: { reprint: true, captainId: captain.id },
    },
    order.version ?? 0,
  );
  if (!saved) {
    return NextResponse.json({ success: false, error: "The order changed. Print again." }, { status: 409 });
  }
  return NextResponse.json({ success: true, data: { reprint: true } });
}
