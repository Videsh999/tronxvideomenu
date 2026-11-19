import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth-server";
import { captainService } from "@/lib/services/captain.service";
import { floorTransferService } from "@/lib/services/floor-transfer.service";
import { OrderServiceError } from "@/lib/services/order.service";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    action: z.enum(["MOVE", "MERGE", "SPLIT_ITEMS", "SPLIT_EQUAL", "VOID_ITEM"]),
    idempotencyKey: z.string().trim().min(8).max(120),
    fromTableId: z.string().min(1).optional(),
    toTableId: z.string().min(1).optional(),
    tableId: z.string().min(1).optional(),
    orderId: z.string().min(1).optional(),
    lineIds: z.array(z.string().min(1)).max(80).optional(),
    lineId: z.string().min(1).optional(),
    quantity: z.number().int().min(1).max(99).optional(),
    ways: z.number().int().min(2).max(20).optional(),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const { captain, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error || !captain) return error ?? NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid floor action." }, { status: 400 });
  }

  const actor = {
    role: "CAPTAIN" as const,
    id: captain.id,
    email: captain.email,
    name: captain.name,
  };
  const restaurantId = captain.restaurantId;

  try {
    const tableIds = [parsed.data.fromTableId, parsed.data.toTableId, parsed.data.tableId].filter(
      (id): id is string => Boolean(id),
    );
    for (const tableId of tableIds) {
      await captainService.assertCaptainMayServeTable(captain.id, restaurantId, tableId);
    }

    if (parsed.data.action === "MOVE") {
      if (!parsed.data.fromTableId || !parsed.data.toTableId) {
        return NextResponse.json({ success: false, error: "Choose the table to move and a free table." }, { status: 400 });
      }
      const data = await floorTransferService.moveTable({
        restaurantId,
        fromTableId: parsed.data.fromTableId,
        toTableId: parsed.data.toTableId,
        idempotencyKey: parsed.data.idempotencyKey,
        actor,
      });
      return NextResponse.json({ success: true, data });
    }

    if (parsed.data.action === "MERGE") {
      if (!parsed.data.fromTableId || !parsed.data.toTableId) {
        return NextResponse.json({ success: false, error: "Choose two occupied tables." }, { status: 400 });
      }
      const data = await floorTransferService.mergeTables({
        restaurantId,
        intoTableId: parsed.data.toTableId,
        fromTableId: parsed.data.fromTableId,
        idempotencyKey: parsed.data.idempotencyKey,
        actor,
      });
      return NextResponse.json({ success: true, data });
    }

    if (parsed.data.action === "SPLIT_ITEMS") {
      if (!parsed.data.tableId || !parsed.data.lineIds?.length) {
        return NextResponse.json({ success: false, error: "Select items to split." }, { status: 400 });
      }
      const data = await floorTransferService.splitItems({
        restaurantId,
        tableId: parsed.data.tableId,
        lineIds: parsed.data.lineIds,
        idempotencyKey: parsed.data.idempotencyKey,
        actor,
      });
      return NextResponse.json({ success: true, data });
    }

    if (parsed.data.action === "SPLIT_EQUAL") {
      if (!parsed.data.tableId || !parsed.data.ways) {
        return NextResponse.json({ success: false, error: "Choose how many ways to split." }, { status: 400 });
      }
      const data = await floorTransferService.splitEqual({
        restaurantId,
        tableId: parsed.data.tableId,
        ways: parsed.data.ways,
        idempotencyKey: parsed.data.idempotencyKey,
        actor,
      });
      return NextResponse.json({ success: true, data });
    }

    if (!parsed.data.tableId || !parsed.data.lineId || !parsed.data.reason) {
      return NextResponse.json({ success: false, error: "A void needs the item and a reason." }, { status: 400 });
    }
    const data = await floorTransferService.requestVoid({
      restaurantId,
      tableId: parsed.data.tableId,
      orderId: parsed.data.orderId,
      lineId: parsed.data.lineId,
      quantity: parsed.data.quantity ?? 1,
      reason: parsed.data.reason,
      idempotencyKey: parsed.data.idempotencyKey,
      actor,
    });
    return NextResponse.json({ success: true, data });
  } catch (cause) {
    if (cause instanceof OrderServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    const message = cause instanceof Error ? cause.message : "Unable to update the floor.";
    const status = /not authorized|not found/i.test(message) ? 404 : 409;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
