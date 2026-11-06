import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { reportingService } from "@/lib/services/reporting.service";
import { tableService } from "@/lib/services/table.service";

/** Assigned-table order stats for captains — operational only, no guest PII. */
export async function GET() {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;
  try {
    const assigned = new Set(captain.assignedTableIds ?? []);
    const [stats, tables] = await Promise.all([
      reportingService.tablePerformance(captain.restaurantId),
      tableService.list(captain.restaurantId),
    ]);
    const assignedNumbers = new Set(
      tables.filter((table) => assigned.has(table.id)).map((table) => table.tableNumber),
    );
    const scoped = stats.tables.filter((row) => assignedNumbers.has(row.tableNumber));
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
