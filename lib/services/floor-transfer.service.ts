import { createHash, randomBytes, randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { billMoneyFields, billingForRecompute } from "@/lib/billing/order-bill";
import { reconcileMergedBill } from "@/lib/billing/merge-bill";
import { billFromStoredLines } from "@/lib/billing/order-bill";
import { assertNoActivePaymentRequest } from "@/lib/billing/payment-request-guard";
import { allocateSplitBills } from "@/lib/billing/split-bill";
import { equalSplitAmounts, partitionBillItems, renumberMovedKots } from "@/lib/captain-floor";
import { FloorActionModel, VoidApprovalModel } from "@/lib/db/models";
import { orderRepository } from "@/lib/repositories/order.repository";
import { tableRepository } from "@/lib/repositories/table.repository";
import { roundMoney } from "@/lib/order-pricing";
import { orderService, OrderServiceError } from "@/lib/services/order.service";
import type { ClientSession } from "mongoose";
import type { OrderEvent, OrderItemSnapshot, PaymentAuditActor, RestaurantOrder } from "@/types";

export type FloorActionResult = {
  duplicate: boolean;
  orderIds: string[];
  shares?: number[];
  total?: number;
};

function floorEvent(
  type: OrderEvent["type"],
  message: string,
  actor: PaymentAuditActor,
  meta: Record<string, unknown>,
): OrderEvent {
  return {
    id: `evt-${randomUUID()}`,
    type,
    at: new Date().toISOString(),
    actor,
    message,
    meta,
  };
}

function activeItems(items: OrderItemSnapshot[]) {
  return items.filter((item) => item.quantity - (item.cancelledQuantity ?? 0) > 0);
}

function activeSubtotal(items: OrderItemSnapshot[]) {
  return roundMoney(
    activeItems(items).reduce((sum, item) => sum + item.itemTotal, 0),
  );
}

async function replay(restaurantId: string, key: string): Promise<FloorActionResult | null> {
  const prior = await orderRepository.findByFloorActionKey(restaurantId, key);
  if (!prior) return null;
  const event = (prior.events ?? []).find((entry) => entry.meta?.floorActionKey === key);
  const shares = event?.meta?.shares;
  return {
    duplicate: true,
    orderIds: [prior.id],
    total: prior.total,
    shares: Array.isArray(shares) ? shares.filter((value): value is number => typeof value === "number") : undefined,
  };
}

async function requireTable(restaurantId: string, tableId: string) {
  const table = await tableRepository.findByRestaurantAndId(restaurantId, tableId);
  if (!table || !table.isActive || table.restaurantId !== restaurantId) {
    throw new OrderServiceError("Table not found.", 404);
  }
  return table;
}

function paidGuard(order: RestaurantOrder) {
  assertNoActivePaymentRequest(order);
  if ((order.payment?.amountPaid ?? 0) > 0 || order.payment?.status === "PAID") {
    throw new OrderServiceError("This bill already has a payment. A captain cannot change it here.", 409);
  }
}

async function readFloorAction(
  session: ClientSession,
  restaurantId: string,
  action: "MOVE" | "MERGE" | "SPLIT_ITEMS" | "SPLIT_EQUAL",
  idempotencyKey: string,
) {
  const existing = await FloorActionModel.findOne({ restaurantId, action, idempotencyKey }).session(session);
  if (!existing) return null;
  return {
    duplicate: true as const,
    orderIds: (existing.orderIds as string[]) ?? [],
    shares: existing.shares as number[] | undefined,
    total: existing.total as number | undefined,
  };
}

async function recordFloorAction(
  session: ClientSession,
  claim: {
    restaurantId: string;
    action: "MOVE" | "MERGE" | "SPLIT_ITEMS" | "SPLIT_EQUAL";
    idempotencyKey: string;
    orderIds: string[];
    shares?: number[];
    total?: number;
  },
) {
  await FloorActionModel.create([{
    id: `floor-${randomUUID()}`,
    restaurantId: claim.restaurantId,
    action: claim.action,
    idempotencyKey: claim.idempotencyKey,
    orderIds: claim.orderIds,
    shares: claim.shares,
    total: claim.total,
    createdAt: new Date().toISOString(),
  }], { session });
}

export class FloorTransferService {
  async moveTable(input: {
    restaurantId: string;
    fromTableId: string;
    toTableId: string;
    idempotencyKey: string;
    actor: PaymentAuditActor;
  }): Promise<FloorActionResult> {
    const seen = await replay(input.restaurantId, input.idempotencyKey);
    if (seen) return seen;
    const from = await requireTable(input.restaurantId, input.fromTableId);
    const to = await requireTable(input.restaurantId, input.toTableId);
    if (from.id === to.id) throw new OrderServiceError("Choose a different table.", 409);
    if (to.status !== "OPEN" && to.status !== "CLEANING") {
      throw new OrderServiceError("The destination table is not free.", 409);
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const session = await mongoose.startSession();
      try {
        let moved: string[] = [];
        let duplicate = false;
        await session.withTransaction(async () => {
          const prior = await readFloorAction(session, input.restaurantId, "MOVE", input.idempotencyKey);
          if (prior) {
            duplicate = true;
            moved = prior.orderIds;
            return;
          }
          const running = await orderRepository.findRunningForTable(input.restaurantId, from.tableNumber, session);
          const blocking = await orderRepository.findRunningForTable(input.restaurantId, to.tableNumber, session);
          if (!running.length) throw new OrderServiceError("This table has no running order.", 409);
          if (blocking.length) throw new OrderServiceError("The destination table is not free.", 409);
          moved = [];
          for (const order of running) {
            assertNoActivePaymentRequest(order);
            const updated = await orderRepository.relocate(
              input.restaurantId,
              order.id,
              { tableId: to.id, tableNumber: to.tableNumber },
              floorEvent(
                "TABLE_MOVED",
                `Moved table ${from.tableNumber} to table ${to.tableNumber}`,
                input.actor,
                {
                  floorActionKey: input.idempotencyKey,
                  restaurantId: input.restaurantId,
                  fromTableId: from.id,
                  toTableId: to.id,
                  fromTableNumber: from.tableNumber,
                  toTableNumber: to.tableNumber,
                  captainId: input.actor.id,
                },
              ),
              order.version ?? 0,
              session,
            );
            if (!updated) throw new Error("version");
            moved.push(updated.id);
          }
          const opened = await tableRepository.setFloorStatus(
            input.restaurantId,
            to.id,
            "OCCUPIED",
            {
              guestCount: from.guestCount ?? running[0]?.guestCount,
              occupiedSince: from.occupiedSince ?? running[0]?.createdAt,
            },
            session,
          );
          const freed = await tableRepository.setFloorStatus(input.restaurantId, from.id, "OPEN", undefined, session);
          if (!opened || !freed) throw new OrderServiceError("Unable to update the tables.", 409);
          await recordFloorAction(session, {
            restaurantId: input.restaurantId,
            action: "MOVE",
            idempotencyKey: input.idempotencyKey,
            orderIds: moved,
          });
        });
        return { duplicate, orderIds: moved };
      } catch (error) {
        if (error instanceof Error && error.message === "version") continue;
        throw error;
      } finally {
        await session.endSession();
      }
    }
    throw new OrderServiceError("The table changed. Try again.", 409);
  }

  async mergeTables(input: {
    restaurantId: string;
    intoTableId: string;
    fromTableId: string;
    idempotencyKey: string;
    actor: PaymentAuditActor;
  }): Promise<FloorActionResult> {
    const seen = await replay(input.restaurantId, input.idempotencyKey);
    if (seen) return seen;
    const into = await requireTable(input.restaurantId, input.intoTableId);
    const from = await requireTable(input.restaurantId, input.fromTableId);
    if (into.id === from.id) throw new OrderServiceError("Choose two different tables.", 409);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const session = await mongoose.startSession();
      try {
        let orderId = "";
        let total = 0;
        let duplicate = false;
        await session.withTransaction(async () => {
          const prior = await readFloorAction(session, input.restaurantId, "MERGE", input.idempotencyKey);
          if (prior) {
            duplicate = true;
            orderId = prior.orderIds[0] ?? "";
            total = prior.total ?? 0;
            return;
          }
          const destinationOrders = await orderRepository.findRunningForTable(input.restaurantId, into.tableNumber, session);
          const sourceOrders = await orderRepository.findRunningForTable(input.restaurantId, from.tableNumber, session);
          const destination = destinationOrders[0];
          if (!destination || !sourceOrders.length) {
            throw new OrderServiceError("Both tables need a running bill.", 409);
          }
          for (const order of [destination, ...sourceOrders]) paidGuard(order);
          const incoming = renumberMovedKots(
            destination.items,
            sourceOrders.flatMap((order) => activeItems(order.items)),
          );
          const merged = [...destination.items, ...incoming];
          const sourceDiscount = sourceOrders.reduce((sum, order) => sum + (order.billDiscountAmount ?? 0), 0);
          const sourcePackaging = sourceOrders.reduce((sum, order) => sum + (order.packagingCharge ?? 0), 0);
          const sourceService = sourceOrders.reduce((sum, order) => sum + (order.serviceCharge ?? 0), 0);
          const reconciled = reconcileMergedBill({
            destinationDiscount: destination.billDiscountAmount ?? 0,
            sourceDiscount,
            destinationBilling: billingForRecompute(destination.billingSettingsSnapshot, destination.billSnapshot),
            destinationPackaging: destination.packagingCharge ?? 0,
            destinationService: destination.serviceCharge ?? 0,
            sourcePackaging,
            sourceService,
            itemsSubtotal: activeSubtotal(merged),
          });
          const bill = billFromStoredLines({
            items: merged,
            billDiscountAmount: reconciled.billDiscountAmount,
            billing: reconciled.billing,
            orderTaxRatePercent: destination.taxRatePercent,
          });
          const saved = await orderRepository.replaceItemsAndTotals(input.restaurantId, destination.id, {
            items: merged,
            ...billMoneyFields(bill),
            event: floorEvent(
              "TABLES_MERGED",
              `Merged table ${from.tableNumber} into table ${into.tableNumber}`,
              input.actor,
              {
                floorActionKey: input.idempotencyKey,
                restaurantId: input.restaurantId,
                intoTableId: into.id,
                fromTableId: from.id,
                fromTableNumber: from.tableNumber,
                intoTableNumber: into.tableNumber,
                sourceOrderIds: sourceOrders.map((order) => order.id),
                captainId: input.actor.id,
              },
            ),
            expectedVersion: destination.version ?? 0,
            session,
          });
          if (!saved) throw new Error("version");
          for (const source of sourceOrders) {
            const emptied = source.items.map((item) => ({
              ...item,
              cancelledQuantity: item.quantity,
              itemTotal: 0,
            }));
            const closed = await orderRepository.replaceItemsAndTotals(input.restaurantId, source.id, {
              items: emptied,
              subtotal: 0,
              taxAmount: 0,
              packagingCharge: 0,
              serviceCharge: 0,
              cgstAmount: 0,
              sgstAmount: 0,
              igstAmount: 0,
              total: 0,
              billDiscountAmount: 0,
              event: floorEvent(
                "TABLES_MERGED",
                `Bill moved to table ${into.tableNumber}`,
                input.actor,
                {
                  floorActionKey: `${input.idempotencyKey}:source:${source.id}`,
                  restaurantId: input.restaurantId,
                  mergedIntoOrderId: destination.id,
                  captainId: input.actor.id,
                },
              ),
              expectedVersion: source.version ?? 0,
              nextStatus: "MERGED",
              mergedIntoOrderId: destination.id,
              session,
            });
            if (!closed) throw new Error("version");
          }
          const guests = Math.min(
            100,
            (into.guestCount ?? destination.guestCount ?? 0) + (from.guestCount ?? sourceOrders[0]?.guestCount ?? 0),
          );
          const openedAt = [into.occupiedSince, from.occupiedSince].filter(Boolean).sort()[0];
          const kept = await tableRepository.setFloorStatus(
            input.restaurantId,
            into.id,
            "OCCUPIED",
            { guestCount: Math.max(1, guests), occupiedSince: openedAt },
            session,
          );
          const freed = await tableRepository.setFloorStatus(input.restaurantId, from.id, "OPEN", undefined, session);
          if (!kept || !freed) throw new OrderServiceError("Unable to update the tables.", 409);
          orderId = saved.id;
          total = saved.total;
          await recordFloorAction(session, {
            restaurantId: input.restaurantId,
            action: "MERGE",
            idempotencyKey: input.idempotencyKey,
            orderIds: [saved.id],
            total: saved.total,
          });
        });
        return { duplicate, orderIds: [orderId], total };
      } catch (error) {
        if (error instanceof Error && error.message === "version") continue;
        throw error;
      } finally {
        await session.endSession();
      }
    }
    throw new OrderServiceError("The tables changed. Try again.", 409);
  }

  async splitItems(input: {
    restaurantId: string;
    tableId: string;
    lineIds: string[];
    idempotencyKey: string;
    actor: PaymentAuditActor;
  }): Promise<FloorActionResult> {
    const seen = await replay(input.restaurantId, input.idempotencyKey);
    if (seen) return seen;
    const table = await requireTable(input.restaurantId, input.tableId);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const session = await mongoose.startSession();
      try {
        let ids: string[] = [];
        let total = 0;
        let duplicate = false;
        await session.withTransaction(async () => {
          const prior = await readFloorAction(session, input.restaurantId, "SPLIT_ITEMS", input.idempotencyKey);
          if (prior) {
            duplicate = true;
            ids = prior.orderIds;
            total = prior.total ?? 0;
            return;
          }
          const running = await orderRepository.findRunningForTable(input.restaurantId, table.tableNumber, session);
          const order = running[0];
          if (!order) throw new OrderServiceError("This table has no running bill.", 409);
          paidGuard(order);
          let parts: { moving: OrderItemSnapshot[]; staying: OrderItemSnapshot[] };
          try {
            parts = partitionBillItems(order.items, input.lineIds);
          } catch (error) {
            throw new OrderServiceError(error instanceof Error ? error.message : "Unable to split the bill.", 409);
          }
          const billing = billingForRecompute(order.billingSettingsSnapshot, order.billSnapshot);
          const allocated = allocateSplitBills({
            staying: parts.staying,
            moving: parts.moving,
            billDiscountAmount: order.billDiscountAmount ?? 0,
            billing,
            orderTaxRatePercent: order.taxRatePercent,
            historicalBill: order.billSnapshot,
          });
          const stayBill = allocated.stay;
          const moveBill = allocated.move;
          const movedLines = renumberMovedKots(parts.staying, parts.moving);
          const stay = await orderRepository.replaceItemsAndTotals(input.restaurantId, order.id, {
            items: parts.staying,
            ...billMoneyFields(stayBill),
            event: floorEvent(
              "BILL_SPLIT",
              `Split ${parts.moving.length} item(s) onto a new bill`,
              input.actor,
              {
                floorActionKey: `${input.idempotencyKey}:stay`,
                restaurantId: input.restaurantId,
                tableId: table.id,
                mode: "ITEMS",
                captainId: input.actor.id,
              },
            ),
            expectedVersion: order.version ?? 0,
            session,
          });
          if (!stay) throw new Error("version");
          const created = await orderRepository.create(
            {
              id: `order-${randomUUID()}`,
              restaurantId: input.restaurantId,
              tableId: table.id,
              tableNumber: table.tableNumber,
              customerTokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"),
              idempotencyKey: input.idempotencyKey,
              status: order.status,
              channel: order.channel,
              source: "CAPTAIN",
              guestCount: order.guestCount,
              items: movedLines,
              subtotal: moveBill.itemsSubtotal,
              billDiscountAmount: moveBill.billDiscount,
              taxRatePercent: moveBill.gstRatePercent,
              taxAmount: moveBill.taxAmount,
              packagingCharge: moveBill.packagingCharge,
              serviceCharge: moveBill.serviceCharge,
              cgstAmount: moveBill.cgstAmount,
              sgstAmount: moveBill.sgstAmount,
              igstAmount: moveBill.igstAmount,
              billSnapshot: moveBill,
              billingSettingsSnapshot: order.billingSettingsSnapshot,
              total: moveBill.total,
              payment: { status: "UNPAID", amountPaid: 0, auditTrail: [], ledger: [] },
              events: [
                floorEvent("BILL_SPLIT", `New bill split from order ${order.orderNumber}`, input.actor, {
                  floorActionKey: input.idempotencyKey,
                  restaurantId: input.restaurantId,
                  tableId: table.id,
                  mode: "ITEMS",
                  sourceOrderId: order.id,
                  captainId: input.actor.id,
                }),
              ],
              version: 0,
            },
            session,
          );
          ids = [stay.id, created.id];
          total = roundMoney(stay.total + created.total);
          await recordFloorAction(session, {
            restaurantId: input.restaurantId,
            action: "SPLIT_ITEMS",
            idempotencyKey: input.idempotencyKey,
            orderIds: ids,
            total,
          });
        });
        return { duplicate, orderIds: ids, total };
      } catch (error) {
        if (error instanceof Error && error.message === "version") continue;
        throw error;
      } finally {
        await session.endSession();
      }
    }
    throw new OrderServiceError("The bill changed. Try again.", 409);
  }

  async splitEqual(input: {
    restaurantId: string;
    tableId: string;
    ways: number;
    idempotencyKey: string;
    actor: PaymentAuditActor;
  }): Promise<FloorActionResult> {
    const table = await requireTable(input.restaurantId, input.tableId);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const session = await mongoose.startSession();
      try {
        let shares: number[] = [];
        let orderId = "";
        let total = 0;
        let duplicate = false;
        await session.withTransaction(async () => {
          const prior = await readFloorAction(session, input.restaurantId, "SPLIT_EQUAL", input.idempotencyKey);
          if (prior) {
            duplicate = true;
            shares = prior.shares ?? [];
            orderId = prior.orderIds[0] ?? "";
            total = prior.total ?? 0;
            return;
          }
          const running = await orderRepository.findRunningForTable(input.restaurantId, table.tableNumber, session);
          const order = running[0];
          if (!order) throw new OrderServiceError("This table has no running bill.", 409);
          paidGuard(order);
          shares = equalSplitAmounts(order.total, input.ways);
          const saved = await orderRepository.appendVersionedEvent(
            input.restaurantId,
            order.id,
            floorEvent("BILL_SPLIT", `Split the bill into ${input.ways} equal shares`, input.actor, {
              floorActionKey: input.idempotencyKey,
              action: "SPLIT_EQUAL",
              restaurantId: input.restaurantId,
              tableId: table.id,
              mode: "EQUAL",
              ways: input.ways,
              shares,
              captainId: input.actor.id,
              paymentCollected: false,
            }),
            order.version ?? 0,
            session,
          );
          if (!saved) throw new Error("version");
          if ((saved.payment?.amountPaid ?? 0) > 0) {
            throw new OrderServiceError("Split must not collect a payment.", 409);
          }
          orderId = saved.id;
          total = saved.total;
          await recordFloorAction(session, {
            restaurantId: input.restaurantId,
            action: "SPLIT_EQUAL",
            idempotencyKey: input.idempotencyKey,
            orderIds: [saved.id],
            shares,
            total: saved.total,
          });
        });
        return { duplicate, orderIds: [orderId], shares, total };
      } catch (error) {
        if (error instanceof Error && error.message === "version") continue;
        if (error instanceof OrderServiceError) throw error;
        throw error;
      } finally {
        await session.endSession();
      }
    }
    throw new OrderServiceError("The bill changed. Try again.", 409);
  }

  /**
   * A captain cannot void. This records a pending approval for a manager or admin.
   * The line stays on the bill until that approval is applied.
   */
  async requestVoid(input: {
    restaurantId: string;
    tableId: string;
    orderId?: string;
    lineId: string;
    quantity: number;
    reason: string;
    idempotencyKey: string;
    actor: PaymentAuditActor;
  }) {
    const reason = input.reason.trim();
    if (reason.length < 3) throw new OrderServiceError("A void needs a reason.", 400);
    const table = await requireTable(input.restaurantId, input.tableId);
    const running = await orderRepository.findRunningForTable(input.restaurantId, table.tableNumber);
    const order = input.orderId ? running.find((entry) => entry.id === input.orderId) : running[0];
    if (!order || order.restaurantId !== input.restaurantId) {
      throw new OrderServiceError("This table has no running bill.", 404);
    }
    const existing = await VoidApprovalModel.findOne({
      restaurantId: input.restaurantId,
      idempotencyKey: input.idempotencyKey,
    }).lean();
    if (existing) return { pending: true as const, approvalId: String(existing.id), duplicate: true as const };
    const id = `void-${randomUUID()}`;
    await VoidApprovalModel.create({
      id,
      restaurantId: input.restaurantId,
      orderId: order.id,
      tableId: table.id,
      lineId: input.lineId,
      quantity: input.quantity,
      reason,
      status: "PENDING",
      idempotencyKey: input.idempotencyKey,
      requestedBy: { role: input.actor.role, id: input.actor.id, name: input.actor.name },
      createdAt: new Date().toISOString(),
    });
    await orderRepository.appendVersionedEvent(
      input.restaurantId,
      order.id,
      floorEvent("VOID_REQUESTED", `Void requested: ${reason}`, input.actor, {
        approvalId: id,
        lineId: input.lineId,
        reason,
        captainId: input.actor.id,
      }),
      order.version ?? 0,
    );
    return { pending: true as const, approvalId: id, duplicate: false as const };
  }

  async approveVoid(input: {
    restaurantId: string;
    approvalId: string;
    approver: PaymentAuditActor;
  }) {
    if (input.approver.role !== "RESTAURANT_ADMIN") {
      throw new OrderServiceError("A manager or admin must approve a void.", 403);
    }
    const approval = await VoidApprovalModel.findOne({
      id: input.approvalId,
      restaurantId: input.restaurantId,
    });
    if (!approval) throw new OrderServiceError("Void request not found.", 404);
    if (approval.status === "APPROVED") {
      return { alreadyApproved: true as const };
    }
    const result = await orderService.cancelOrderLines(input.restaurantId, String(approval.orderId), {
      lines: [{ lineId: String(approval.lineId), quantity: Number(approval.quantity) }],
      reason: `${approval.reason} (approved by ${input.approver.name ?? input.approver.id})`,
      idempotencyKey: `void-approved-${approval.id}`,
      actor: input.approver,
    });
    approval.status = "APPROVED";
    approval.approver = { role: input.approver.role, id: input.approver.id, name: input.approver.name };
    approval.approvedAt = new Date().toISOString();
    await approval.save();
    return { alreadyApproved: false as const, order: result.order, approverId: input.approver.id, reason: String(approval.reason) };
  }
}

export const floorTransferService = new FloorTransferService();
