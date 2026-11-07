import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import { captainService } from "@/lib/services/captain.service";
import { tableRepository } from "@/lib/repositories/table.repository";

const schema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT", "CORRECTION"]),
    reason: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().uuid(),
    sendToKitchen: z.boolean().optional().default(false),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;
  const { orderId } = await params;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Invalid authorization request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const order = await orderService.getForRestaurant(captain.restaurantId, orderId);
    if (!order) {
      return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
    }

    const table = await tableRepository.findByRestaurantAndNumber(
      captain.restaurantId,
      order.tableNumber,
    );
    if (!table) {
      return NextResponse.json({ success: false, error: "Table not found for order" }, { status: 404 });
    }

    await captainService.assertCaptainMayServeTable(captain.id, captain.restaurantId, table.id);

    const updated = await orderService.decideCaptainAuthorization(
      captain.restaurantId,
      orderId,
      parsed.data,
      {
        role: "CAPTAIN",
        id: captain.id,
        email: captain.email,
        name: captain.name,
      },
    );

    return NextResponse.json({
      success: true,
      data: updated,
      meta: {
        decision: parsed.data.decision,
        sentToKitchen:
          parsed.data.decision === "APPROVE" &&
          ["ACCEPTED", "PREPARING", "READY"].includes(updated.status),
      },
    });
  } catch (cause) {
    if (cause instanceof OrderServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json(
      { success: false, error: cause instanceof Error ? cause.message : "Authorization failed" },
      { status: 500 },
    );
  }
}
