import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCaptain } from "@/lib/auth-server";
import { captainService } from "@/lib/services/captain.service";
import { tableRepository } from "@/lib/repositories/table.repository";
import { orderRepository } from "@/lib/repositories/order.repository";
import { tableSessionService, TableSessionServiceError } from "@/lib/services/table-session.service";
import { restaurantService } from "@/lib/services/restaurant.service";
import { resolveCaptainPermissions } from "@/lib/captain-permissions";
import { buildUpiPaymentUri, isValidUpiId } from "@/lib/upi-payment";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("GENERATE_BILL"), sessionId: z.string().min(1), tipAmount: z.number().min(0).max(1_000_000).optional(), revise: z.boolean().optional() }).strict(),
  z.object({ action: z.literal("SPLIT_BILL"), billId: z.string().min(1), version: z.number().int().min(1), mode: z.enum(["EQUAL", "ITEMS", "CUSTOM"]), customers: z.number().int().min(2).max(50).optional(), custom: z.array(z.object({ label: z.string().trim().max(80), amount: z.number().positive() })).optional(), items: z.array(z.object({ label: z.string().trim().max(80), lines: z.array(z.object({ allocationKey: z.string().min(1), quantity: z.number().int().positive() })).min(1) })).optional() }).strict(),
  z.object({ action: z.literal("RECORD_PAYMENT"), billId: z.string().min(1), amount: z.number().positive(), method: z.enum(["CASH", "UPI", "CARD"]), allocationId: z.string().optional(), idempotencyKey: z.string().uuid() }).strict(),
  z.object({ action: z.literal("CLOSE_SESSION"), sessionId: z.string().min(1) }).strict(),
  z.object({ action: z.literal("MOVE_TABLE"), sessionId: z.string().min(1), destinationTableId: z.string().min(1), destinationTableNumber: z.number().int().positive(), destinationLocationType: z.enum(["TABLE", "ROOM"]) }).strict(),
  z.object({ action: z.literal("MERGE_TABLE"), sessionId: z.string().min(1), destinationSessionId: z.string().min(1) }).strict(),
]);

async function authorize(tableId: string) {
  const auth = await requireCaptain("ORDER_MANAGEMENT");
  if (auth.error) return { error: auth.error } as const;
  try {
    await captainService.assertCaptainMayServeTable(auth.captain.id, auth.captain.restaurantId, tableId);
    return { captain: auth.captain, restaurant: auth.restaurant } as const;
  } catch (error) {
    return { error: NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Forbidden" }, { status: 403 }) } as const;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  const auth = await authorize(tableId);
  if (auth.error) return auth.error;
  const table = await tableRepository.findByRestaurantAndId(auth.captain.restaurantId, tableId);
  if (!table) return NextResponse.json({ success: false, error: "Table not found" }, { status: 404 });
  let overview = await tableSessionService.overview(auth.captain.restaurantId, tableId);
  if (!overview.session && await orderRepository.findActiveForTable(auth.captain.restaurantId, table.id)) {
    await tableSessionService.ensureActive({ restaurant: auth.restaurant, table, openedBy: { role: "CAPTAIN", id: auth.captain.id, name: auth.captain.name, email: auth.captain.email } });
    overview = await tableSessionService.overview(auth.captain.restaurantId, tableId);
  }
  return NextResponse.json({ success: true, data: overview });
}

export async function POST(request: Request, { params }: { params: Promise<{ tableId: string }> }) {
  const { tableId } = await params;
  const auth = await authorize(tableId);
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ success: false, error: "Invalid session billing request", details: parsed.error.issues }, { status: 400 });
  const actor = { role: "CAPTAIN" as const, id: auth.captain.id, name: auth.captain.name, email: auth.captain.email };
  try {
    const sourceSessionId = parsed.data.action === "SPLIT_BILL" || parsed.data.action === "RECORD_PAYMENT"
      ? (await tableSessionService.billSessionId(auth.captain.restaurantId, parsed.data.billId))
      : parsed.data.sessionId;
    const sourceSession = await tableSessionService.findSession(auth.captain.restaurantId, sourceSessionId);
    if (!sourceSession || sourceSession.serviceLocationId !== tableId || !["ACTIVE", "BILLING", "PAYMENT_PENDING"].includes(sourceSession.status)) {
      throw new TableSessionServiceError("This bill or session does not belong to the selected table.", 403);
    }
    let data;
    if (parsed.data.action === "GENERATE_BILL") data = await tableSessionService.generateBill({ restaurantId: auth.captain.restaurantId, tableSessionId: parsed.data.sessionId, actor, tipAmount: parsed.data.tipAmount, revise: parsed.data.revise });
    else if (parsed.data.action === "SPLIT_BILL") data = await tableSessionService.splitBill({ restaurantId: auth.captain.restaurantId, ...parsed.data });
    else if (parsed.data.action === "RECORD_PAYMENT") {
      if (parsed.data.method === "UPI") throw new TableSessionServiceError("UPI requires verified provider payment. Manual UPI recording is unavailable for consolidated bills.", 409);
      const permissions = resolveCaptainPermissions(auth.captain);
      const allowed = parsed.data.method === "CASH" ? permissions.recordCashPayment : permissions.recordCardPayment;
      if (!allowed) return NextResponse.json({ success: false, error: `Captain cannot record ${parsed.data.method} payments.` }, { status: 403 });
      data = await tableSessionService.recordPayment({ restaurantId: auth.captain.restaurantId, actor, ...parsed.data });
    } else {
      if (parsed.data.action === "CLOSE_SESSION") {
        data = await tableSessionService.close(auth.captain.restaurantId, parsed.data.sessionId, actor);
      } else if (parsed.data.action === "MOVE_TABLE") {
        await captainService.assertCaptainMayServeTable(auth.captain.id, auth.captain.restaurantId, parsed.data.destinationTableId);
        const destination = await tableRepository.findByRestaurantAndId(auth.captain.restaurantId, parsed.data.destinationTableId);
        if (!destination?.isActive || destination.tableNumber !== parsed.data.destinationTableNumber || (destination.locationType ?? "TABLE") !== parsed.data.destinationLocationType) throw new TableSessionServiceError("Destination table is invalid.", 400);
        data = await tableSessionService.move(auth.captain.restaurantId, parsed.data.sessionId, { id: destination.id, tableNumber: destination.tableNumber, locationType: destination.locationType ?? "TABLE" });
      } else {
        const destination = await tableRepository.findByRestaurantAndId(auth.captain.restaurantId, parsed.data.destinationSessionId);
        if (!destination?.isActive) throw new TableSessionServiceError("Destination table is invalid.", 400);
        await captainService.assertCaptainMayServeTable(auth.captain.id, auth.captain.restaurantId, destination.id);
        const destinationOverview = await tableSessionService.overview(auth.captain.restaurantId, destination.id);
        if (!destinationOverview.session) throw new TableSessionServiceError("Destination table has no active session.", 409);
        data = await tableSessionService.merge(auth.captain.restaurantId, parsed.data.sessionId, destinationOverview.session.id);
      }
    }
    const restaurant = await restaurantService.getById(auth.captain.restaurantId);
    const upiId = restaurant?.billing?.upiId ?? "";
    const paymentUri = data && "outstandingAmount" in data && data.outstandingAmount > 0 && restaurant?.billing?.upiEnabled && isValidUpiId(upiId)
      ? buildUpiPaymentUri({ upiId, payeeName: restaurant.billing?.upiPayeeName || restaurant.name, amount: data.outstandingAmount, orderNumber: "billNumber" in data ? data.billNumber : String((data as { id?: string }).id ?? "bill") })
      : undefined;
    return NextResponse.json({ success: true, data, meta: { paymentUri } });
  } catch (error) {
    const status = error instanceof TableSessionServiceError ? error.statusCode : 409;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Session billing failed" }, { status });
  }
}
