import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { reportingService } from "@/lib/services/reporting.service";

/** Assigned-table order stats for captains — operational only, no guest PII. */
export async function GET() {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;
  try {
    const assigned = new Set(captain.assignedTableIds ?? []);
    const stats = await reportingService.tablePerformance(captain.restaurantId);
    const scoped = stats.tables.filter((row) => row.tableId && assigned.has(row.tableId));
    return NextResponse.json({
      success: true,
      data: {
        tables: scoped,
        busiestTableNumber: scoped[0]?.tableNumber ?? null,
      },
    });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load table stats" }, { status: 500 });
  }
}
