import { NextResponse } from "next/server";
import {
  requireCaptain,
  requireRestaurantAdmin,
  unauthorizedResponse,
} from "@/lib/auth-server";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import type { PaymentAuditActor } from "@/types";
import { z } from "zod";

export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store, max-age=0" };
type Context = { params: Promise<{ orderId: string }> };

const cancelLinesSchema = z.object({
  lines: z
    .array(
      z.object({
        lineId: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  reason: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().min(8).max(120),
  confirm: z.literal(true),
});

async function resolveActor(): Promise<
  | { ok: true; restaurantId: string; actor: PaymentAuditActor }
  | { ok: false; response: NextResponse }
> {
  const { admin, error: adminError } = await requireRestaurantAdmin();
  if (admin) {
    return {
      ok: true,
      restaurantId: admin.restaurantId,
      actor: {
        role: "RESTAURANT_ADMIN",
        id: admin.email,
        email: admin.email,
      },
    };
  }

  const { captain, error: captainError } = await requireCaptain("ORDER_MANAGEMENT");
  if (captain) {
    return {
      ok: true,
      restaurantId: captain.restaurantId,
      actor: {
        role: "CAPTAIN",
        id: captain.id,
        name: captain.name,
      },
    };
  }

  return { ok: false, response: adminError ?? captainError ?? unauthorizedResponse() };
}

export async function POST(request: Request, context: Context) {
  const resolved = await resolveActor();
  if (!resolved.ok) return resolved.response;

  const { orderId } = await context.params;
  const parsed = cancelLinesSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Provide lines, a reason, idempotencyKey, and confirm:true.",
        details: parsed.error.flatten(),
      },
      { status: 400, headers: noStore },
    );
  }

  try {
    const data = await orderService.cancelOrderLines(resolved.restaurantId, orderId, {
      ...parsed.data,
      actor: resolved.actor,
    });
    return NextResponse.json({ success: true, data }, { headers: noStore });
  } catch (cause) {
    if (cause instanceof OrderServiceError) {
      return NextResponse.json(
        { success: false, error: cause.message },
        { status: cause.statusCode, headers: noStore },
      );
    }
    return NextResponse.json(
      { success: false, error: "Unable to cancel order lines." },
      { status: 500, headers: noStore },
    );
  }
}

export async function GET(_request: Request, context: Context) {
  const resolved = await resolveActor();
  if (!resolved.ok) return resolved.response;
  const { orderId } = await context.params;
  const data = await orderService.listLineCancellations(resolved.restaurantId, orderId);
  return NextResponse.json({ success: true, data }, { headers: noStore });
}
