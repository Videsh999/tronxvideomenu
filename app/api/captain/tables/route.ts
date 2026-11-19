import { NextResponse } from "next/server";
import { requireCaptain } from "@/lib/auth-server";
import { tableService } from "@/lib/services/table.service";

export async function GET() {
  const { captain, error } = await requireCaptain("TABLE_MANAGEMENT");
  if (error) return error;
  try {
    const tables = await tableService.list(captain.restaurantId);
    return NextResponse.json({
      success: true,
      data: tables.filter((table) => table.restaurantId === captain.restaurantId),
    });
  } catch {
    return NextResponse.json({ success: false, error: "Unable to load tables" }, { status: 500 });
  }
}
