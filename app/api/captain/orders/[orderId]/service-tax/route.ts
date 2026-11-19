import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth-server";
import { billFromStoredLines, billMoneyFields, billingForRecompute } from "@/lib/billing/order-bill";
import { orderRepository } from "@/lib/repositories/order.repository";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["PERCENT", "AMOUNT"]),
  value: z.number().min(0).max(100000),
}).strict();

/** Captain sets an optional service tax on the open bill. Percent is capped at 20. */
export async function POST(request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain) return error ?? NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Choose a percent or an amount." }, { status: 400 });
  }
  if (parsed.data.mode === "PERCENT" && parsed.data.value > 20) {
    return NextResponse.json({ success: false, error: "Service tax cannot be more than 20%." }, { status: 400 });
  }
  const { orderId } = await context.params;
  const current = await orderRepository.findByRestaurantAndId(captain.restaurantId, orderId);
  if (!current) return NextResponse.json({ success: false, error: "Order not found" }, { status: 404 });
  const base = billingForRecompute(current.billingSettingsSnapshot, current.billSnapshot);
  const billing = parsed.data.mode === "PERCENT"
    ? { ...base, serviceChargeEnabled: parsed.data.value > 0, serviceChargeType: "PERCENT" as const, serviceChargePercent: parsed.data.value }
    : { ...base, serviceChargeEnabled: parsed.data.value > 0, serviceChargeType: "FIXED" as const, serviceChargeAmount: parsed.data.value };
  const bill = billFromStoredLines({
    items: current.items,
    billDiscountAmount: current.billDiscountAmount ?? 0,
    billing,
    orderTaxRatePercent: current.taxRatePercent,
  });
  const saved = await orderRepository.replaceItemsAndTotals(captain.restaurantId, orderId, {
    items: current.items,
    ...billMoneyFields(bill),
    billingSettingsSnapshot: billing,
    event: {
      id: `evt-${crypto.randomUUID()}`,
      type: "NOTE",
      at: new Date().toISOString(),
      actor: { role: "CAPTAIN", id: captain.id, name: captain.name },
      message: parsed.data.value === 0
        ? "Service tax removed"
        : `Service tax set to ${parsed.data.mode === "PERCENT" ? `${parsed.data.value}%` : `₹${parsed.data.value}`}`,
      meta: { serviceTax: parsed.data, captainId: captain.id },
    },
    expectedVersion: current.version ?? 0,
  });
  if (!saved) {
    return NextResponse.json({ success: false, error: "The bill changed. Try again." }, { status: 409 });
  }
  return NextResponse.json({ success: true, data: saved });
}
