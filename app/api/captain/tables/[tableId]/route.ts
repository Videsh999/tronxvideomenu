import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth-server";
import { captainService } from "@/lib/services/captain.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import { orderService } from "@/lib/services/order.service";
import { serviceRequestService } from "@/lib/services/service-request.service";
import type { TableStatus } from "@/types";
import { tableSessionService } from "@/lib/services/table-session.service";

const patchSchema = z
  .object({
    action: z.enum([
      "START_SERVICE",
      "SET_GUEST_COUNT",
      "REQUEST_BILL",
      "MARK_PAYMENT_PENDING",
      "REQUEST_CLEANING",
      "COMPLETE_CLEANING",
      "ADD_NOTE",
    ]),
    guestCount: z.number().int().min(1).max(100).optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tableId: string }> },
) {
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;
  const { tableId } = await params;

  try {
    await captainService.assertCaptainMayServeTable(captain.id, captain.restaurantId, tableId);
  } catch (authError) {
    return NextResponse.json(
      { success: false, error: authError instanceof Error ? authError.message : "Forbidden" },
      { status: 403 },
    );
  }

  const table = await tableRepository.findByRestaurantAndId(captain.restaurantId, tableId);
  if (!table) {
    return NextResponse.json({ success: false, error: "Table not found" }, { status: 404 });
  }

  let overview = await tableSessionService.overview(captain.restaurantId, table.id);
  const legacyActiveOrder = await orderService.findActiveForTable(captain.restaurantId, table.id);
  if (!overview.session && legacyActiveOrder) {
    await tableSessionService.ensureActive({ restaurant, table, openedBy: { role: "CAPTAIN", id: captain.id, name: captain.name, email: captain.email } });
    overview = await tableSessionService.overview(captain.restaurantId, table.id);
  }
  const [requests] = await Promise.all([
    serviceRequestService.listForTable(captain.restaurantId, tableId),
  ]);
  const activeOrder = [...overview.orders].reverse().find((order) => !["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"].includes(order.status)) ?? null;

  return NextResponse.json({
    success: true,
    data: {
      table,
      activeOrder,
      session: overview.session,
      orders: overview.orders,
      bill: overview.bill,
      requests,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ tableId: string }> },
) {
  const { captain, restaurant, error } = await requireCaptain("ORDER_MANAGEMENT");
  if (error) return error;
  const { tableId } = await params;

  try {
    await captainService.assertCaptainMayServeTable(captain.id, captain.restaurantId, tableId);
  } catch (authError) {
    return NextResponse.json(
      { success: false, error: authError instanceof Error ? authError.message : "Forbidden" },
      { status: 403 },
    );
  }

  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Invalid floor action" }, { status: 400 });
  }

  const table = await tableRepository.findByRestaurantAndId(captain.restaurantId, tableId);
  if (!table || !table.isActive) {
    return NextResponse.json({ success: false, error: "Table not found" }, { status: 404 });
  }

  const active = await orderService.findActiveForTable(captain.restaurantId, table.id);
  let nextStatus: TableStatus | null = null;

  switch (parsed.data.action) {
    case "START_SERVICE":
      if (table.status !== "OPEN" && table.status !== "CLEANING") {
        return NextResponse.json(
          { success: false, error: "Table is already in service." },
          { status: 409 },
        );
      }
      nextStatus = "OCCUPIED";
      break;
    case "REQUEST_BILL":
      if (!active) {
        return NextResponse.json(
          { success: false, error: "No active order to bill." },
          { status: 409 },
        );
      }
      nextStatus = "BILL_REQUESTED";
      await serviceRequestService.create({
        restaurantId: captain.restaurantId,
        tableId: table.id,
        tableNumber: table.tableNumber,
        captainId: captain.id,
        type: "BILL",
        note: parsed.data.note,
      });
      break;
    case "MARK_PAYMENT_PENDING":
      nextStatus = "PAYMENT_PENDING";
      break;
    case "REQUEST_CLEANING":
      if (active && active.payment?.status !== "PAID") {
        return NextResponse.json(
          { success: false, error: "Cannot clean while an unpaid order is open." },
          { status: 409 },
        );
      }
      nextStatus = "CLEANING";
      await serviceRequestService.create({
        restaurantId: captain.restaurantId,
        tableId: table.id,
        tableNumber: table.tableNumber,
        captainId: captain.id,
        type: "CLEANING",
        note: parsed.data.note,
      });
      break;
    case "COMPLETE_CLEANING":
      if (active && !["COMPLETED", "CANCELLED", "REJECTED", "SERVED"].includes(active.status)) {
        return NextResponse.json(
          { success: false, error: "Active order still open — cannot free table." },
          { status: 409 },
        );
      }
      nextStatus = "OPEN";
      break;
    case "SET_GUEST_COUNT":
    case "ADD_NOTE":
      break;
  }

  let updated = table;
  if (nextStatus) {
    const floor = await tableRepository.setFloorStatus(captain.restaurantId, tableId, nextStatus);
    if (!floor) {
      return NextResponse.json({ success: false, error: "Unable to update table" }, { status: 500 });
    }
    updated = floor;
  }

  if (parsed.data.action === "START_SERVICE" && restaurant) {
    await tableSessionService.ensureActive({
      restaurant,
      table: updated,
      openedBy: { role: "CAPTAIN", id: captain.id, name: captain.name, email: captain.email },
      guestCount: parsed.data.guestCount,
    });
  }

  if (parsed.data.action === "SET_GUEST_COUNT" && parsed.data.guestCount && active) {
    // Guest count is stored on the order when present.
    await tableRepository.update(captain.restaurantId, tableId, {});
  }

  if (parsed.data.note && parsed.data.action === "ADD_NOTE") {
    await serviceRequestService.create({
      restaurantId: captain.restaurantId,
      tableId: table.id,
      tableNumber: table.tableNumber,
      captainId: captain.id,
      type: "OTHER",
      note: parsed.data.note,
    });
  }

  return NextResponse.json({ success: true, data: updated });
}
