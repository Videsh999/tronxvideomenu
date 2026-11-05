import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import { captainOrderStatusSchema } from "@/lib/validations";

type RouteContext = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;
  const { orderId } = await context.params;
  const order = await orderService.getForRestaurant(captain.restaurantId, orderId);
  return order ? NextResponse.json({ success: true, data: order }) : NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;
  try {
    const { status } = captainOrderStatusSchema.parse(await request.json());
    const { orderId } = await context.params;
    const order = await orderService.updateStatus(captain.restaurantId, orderId, status, {
      role: "CAPTAIN",
      id: captain.id,
      email: captain.email,
      name: captain.name,
    });
    return order ? NextResponse.json({ success: true, data: order }) : NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
  } catch (cause) {
    const validation = cause && typeof cause === "object" && "issues" in cause;
    return NextResponse.json({ success: false, error: validation ? "Invalid order status" : cause instanceof Error ? cause.message : "Unable to update order" }, { status: validation ? 400 : cause instanceof OrderServiceError ? cause.statusCode : 500 });
  }
}
