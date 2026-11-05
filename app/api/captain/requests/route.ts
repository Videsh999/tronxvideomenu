import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth-server";
import { captainService } from "@/lib/services/captain.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import { serviceRequestService } from "@/lib/services/service-request.service";

const createSchema = z
  .object({
    tableId: z.string().min(1),
    type: z.enum([
      "WATER",
      "EXTRA_PLATES",
      "CUTLERY",
      "NAPKINS",
      "ASSISTANCE",
      "CLEANING",
      "BILL",
      "OTHER",
    ]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export async function GET() {
  const { captain, error } = await requireCaptain();
  if (error) return error;
  const assigned = captain.assignedTableIds ?? [];
  const data = await serviceRequestService.listOpenForCaptain(captain.restaurantId, assigned);
  return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
  const { captain, error } = await requireCaptain();
  if (error) return error;

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  try {
    await captainService.assertCaptainMayServeTable(
      captain.id,
      captain.restaurantId,
      parsed.data.tableId,
    );
  } catch (authError) {
    return NextResponse.json(
      { success: false, error: authError instanceof Error ? authError.message : "Forbidden" },
      { status: 403 },
    );
  }

  const table = await tableRepository.findByRestaurantAndId(
    captain.restaurantId,
    parsed.data.tableId,
  );
  if (!table) {
    return NextResponse.json({ success: false, error: "Table not found" }, { status: 404 });
  }

  const created = await serviceRequestService.create({
    restaurantId: captain.restaurantId,
    tableId: table.id,
    tableNumber: table.tableNumber,
    captainId: captain.id,
    type: parsed.data.type,
    note: parsed.data.note,
  });

  if (parsed.data.type === "BILL") {
    await tableRepository.setFloorStatus(captain.restaurantId, table.id, "BILL_REQUESTED");
  }
  if (parsed.data.type === "CLEANING") {
    await tableRepository.setFloorStatus(captain.restaurantId, table.id, "CLEANING");
  }

  return NextResponse.json({ success: true, data: created }, { status: 201 });
}
