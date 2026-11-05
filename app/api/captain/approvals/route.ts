import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { orderService } from "@/lib/services/order.service";
import { tableService } from "@/lib/services/table.service";

export async function GET() {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;

  try {
    const assigned = new Set(captain.assignedTableIds ?? []);
    const tables = await tableService.list(captain.restaurantId);
    const tableNumbers = tables
      .filter((table) => assigned.has(table.id))
      .map((table) => table.tableNumber);

    const data = await orderService.listPendingCaptainApprovals(
      captain.restaurantId,
      tableNumbers,
    );
    return NextResponse.json({ success: true, data });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load approvals" }, { status: 500 });
  }
}
