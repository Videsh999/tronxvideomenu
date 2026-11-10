import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";

export async function GET() {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;

  try {
    const assigned = new Set(captain.assignedTableIds ?? []);
    const data = await orderService.listPendingCaptainApprovals(
      captain.restaurantId,
      [...assigned],
    );
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load approvals" }, { status: 500 });
  }
}
