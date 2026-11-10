/**
 * Captain floor actions: move, merge, split, and void stay inside one outlet
 * and use the server bill. Captains do not collect a payment while splitting.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { calculateRestaurantBill } from "../../lib/billing/calculate-bill";
import type { OrderItemSnapshot, PaymentAuditActor } from "../../types";
import { connectReplicaSet, disconnectTestDatabase, integrationEnabled } from "./harness";

const actor: PaymentAuditActor = { role: "CAPTAIN", id: "cap-floor", name: "Captain" };
const enabled = integrationEnabled();
const billing = {
  gstEnabled: true,
  gstRatePercent: 5,
  taxRatePercent: 5,
  taxLabel: "GST",
  priceMode: "EXCLUSIVE" as const,
  supplyType: "INTRA_STATE" as const,
  packagingEnabled: false,
  serviceChargeEnabled: false,
};

test.before(async () => {
  if (!enabled) return;
  await connectReplicaSet();
});

test.after(async () => {
  if (!enabled) return;
  await disconnectTestDatabase();
});

async function seedPair(label: string) {
  const { RestaurantModel, CategoryModel, DishModel, TableModel } = await import("../../lib/db/models");
  const id = `floor-${label}-${randomUUID()}`;
  const now = new Date().toISOString();
  await RestaurantModel.create({
    id,
    name: label,
    slug: id,
    isOpen: true,
    isActive: true,
    currency: "INR",
    subscriptionPlan: "STARTER",
    subscriptionEnabled: true,
    billing,
    createdAt: now,
    updatedAt: now,
  });
  await CategoryModel.create({
    id: `${id}-cat`,
    restaurantId: id,
    name: "Mains",
    sortOrder: 1,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  });
  await DishModel.create({
    id: `${id}-dal`,
    restaurantId: id,
    categoryId: `${id}-cat`,
    name: "Dal",
    price: 100,
    isVeg: true,
    isAvailable: true,
    sortOrder: 1,
    taxRatePercent: 5,
    variants: [],
    createdAt: now,
    updatedAt: now,
  });
  await DishModel.create({
    id: `${id}-rice`,
    restaurantId: id,
    categoryId: `${id}-cat`,
    name: "Rice",
    price: 40,
    isVeg: true,
    isAvailable: true,
    sortOrder: 2,
    taxRatePercent: 5,
    variants: [],
    createdAt: now,
    updatedAt: now,
  });
  for (const number of [1, 2]) {
    await TableModel.create({
      id: `${id}-t${number}`,
      restaurantId: id,
      tableNumber: number,
      capacity: 4,
      isActive: true,
      status: "OPEN",
      createdAt: now,
      updatedAt: now,
    });
  }
  return id;
}

function expectedTotal(items: OrderItemSnapshot[]) {
  return calculateRestaurantBill({
    lines: items
      .filter((item) => item.quantity - (item.cancelledQuantity ?? 0) > 0)
      .map((item) => ({
        lineTotal: item.itemTotal,
        quantity: item.quantity - (item.cancelledQuantity ?? 0),
        gstRatePercent: item.gstRateSnapshot ?? 5,
      })),
    billDiscountAmount: 0,
    billing,
  }).total;
}

async function openOrder(restaurantId: string, tableNumber: number, dishes: string[]) {
  const { orderService } = await import("../../lib/services/order.service");
  const { tableRepository } = await import("../../lib/repositories/table.repository");
  const table = await tableRepository.findByRestaurantAndNumber(restaurantId, tableNumber);
  await tableRepository.setFloorStatus(restaurantId, table!.id, "OCCUPIED", {
    guestCount: 2,
    occupiedSince: new Date().toISOString(),
  });
  return orderService.createPosOrder(
    restaurantId,
    restaurantId,
    {
      channel: "POS_DINE_IN",
      tableNumber,
      guestCount: 2,
      idempotencyKey: randomUUID(),
      items: dishes.map((dishId) => ({ dishId: `${restaurantId}-${dishId}`, quantity: 1, selections: [] })),
    },
    actor,
  );
}

test("moving a table transfers the running order and frees the old table", async () => {
  if (!enabled) return;
  const restaurantId = await seedPair("move");
  const order = await openOrder(restaurantId, 1, ["dal"]);
  const { floorTransferService } = await import("../../lib/services/floor-transfer.service");
  const { tableRepository } = await import("../../lib/repositories/table.repository");
  const { orderRepository } = await import("../../lib/repositories/order.repository");
  await floorTransferService.moveTable({
    restaurantId,
    fromTableId: `${restaurantId}-t1`,
    toTableId: `${restaurantId}-t2`,
    idempotencyKey: randomUUID(),
    actor,
  });
  const moved = await orderRepository.findByRestaurantAndId(restaurantId, order.id);
  assert.equal(moved?.tableNumber, 2);
  assert.equal(moved?.events?.some((event) => event.type === "TABLE_MOVED"), true);
  assert.equal((await tableRepository.findByRestaurantAndId(restaurantId, `${restaurantId}-t1`))?.status, "OPEN");
  assert.equal((await tableRepository.findByRestaurantAndId(restaurantId, `${restaurantId}-t2`))?.status, "OCCUPIED");
});

test("a move key replays and two moves of one table cannot both land", async () => {
  if (!enabled) return;
  const restaurantId = await seedPair("race");
  const { TableModel } = await import("../../lib/db/models");
  const now = new Date().toISOString();
  await TableModel.create({
    id: `${restaurantId}-t3`,
    restaurantId,
    tableNumber: 3,
    capacity: 4,
    isActive: true,
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
  });
  await openOrder(restaurantId, 1, ["dal"]);
  const { floorTransferService } = await import("../../lib/services/floor-transfer.service");
  const { orderRepository } = await import("../../lib/repositories/order.repository");
  const key = randomUUID();
  const first = await floorTransferService.moveTable({
    restaurantId,
    fromTableId: `${restaurantId}-t1`,
    toTableId: `${restaurantId}-t2`,
    idempotencyKey: key,
    actor,
  });
  const replay = await floorTransferService.moveTable({
    restaurantId,
    fromTableId: `${restaurantId}-t1`,
    toTableId: `${restaurantId}-t2`,
    idempotencyKey: key,
    actor,
  });
  assert.equal(replay.duplicate, true);
  assert.deepEqual(replay.orderIds, first.orderIds);

  await openOrder(restaurantId, 3, ["rice"]);
  const raced = await Promise.allSettled([
    floorTransferService.moveTable({
      restaurantId,
      fromTableId: `${restaurantId}-t3`,
      toTableId: `${restaurantId}-t1`,
      idempotencyKey: randomUUID(),
      actor,
    }),
    floorTransferService.moveTable({
      restaurantId,
      fromTableId: `${restaurantId}-t3`,
      toTableId: `${restaurantId}-t2`,
      idempotencyKey: randomUUID(),
      actor,
    }),
  ]);
  assert.equal(raced.filter((result) => result.status === "fulfilled").length, 1);
  const rice = await orderRepository.findByRestaurantAndId(
    restaurantId,
    (await (await import("../../lib/db/models")).OrderModel.findOne({ restaurantId, "items.dishId": `${restaurantId}-rice` }).lean())?.id ?? "",
  );
  assert.ok(rice?.tableNumber === 1 || rice?.tableNumber === 2);
  assert.notEqual(rice?.tableNumber, 3);
});

test("an active payment request blocks a move until superseding is implemented", async () => {
  if (!enabled) return;
  const restaurantId = await seedPair("payreq");
  const order = await openOrder(restaurantId, 1, ["dal"]);
  const { OrderModel } = await import("../../lib/db/models");
  const { floorTransferService } = await import("../../lib/services/floor-transfer.service");
  const { PaymentRequestNotImplemented } = await import("../../lib/billing/payment-request-guard");
  await OrderModel.updateOne({ id: order.id }, { $set: { paymentRequestStatus: "ACTIVE" } });
  await assert.rejects(
    () => floorTransferService.moveTable({
      restaurantId,
      fromTableId: `${restaurantId}-t1`,
      toTableId: `${restaurantId}-t2`,
      idempotencyKey: randomUUID(),
      actor,
    }),
    (error: unknown) => error instanceof PaymentRequestNotImplemented,
  );
});

test("one outlet cannot move another outlet's table", async () => {
  if (!enabled) return;
  const outletA = await seedPair("a");
  const outletB = await seedPair("b");
  await openOrder(outletB, 1, ["dal"]);
  const { floorTransferService } = await import("../../lib/services/floor-transfer.service");
  const { OrderServiceError } = await import("../../lib/services/order.service");
  await assert.rejects(
    () =>
      floorTransferService.moveTable({
        restaurantId: outletA,
        fromTableId: `${outletB}-t1`,
        toTableId: `${outletA}-t2`,
        idempotencyKey: randomUUID(),
        actor,
      }),
    (error: unknown) => error instanceof OrderServiceError && error.statusCode === 404,
  );
});

test("merging two occupied tables keeps one server-calculated bill", async () => {
  if (!enabled) return;
  const restaurantId = await seedPair("merge");
  await openOrder(restaurantId, 1, ["dal"]);
  await openOrder(restaurantId, 2, ["rice"]);
  const { floorTransferService } = await import("../../lib/services/floor-transfer.service");
  const { orderRepository } = await import("../../lib/repositories/order.repository");
  const { tableRepository } = await import("../../lib/repositories/table.repository");
  const result = await floorTransferService.mergeTables({
    restaurantId,
    intoTableId: `${restaurantId}-t1`,
    fromTableId: `${restaurantId}-t2`,
    idempotencyKey: randomUUID(),
    actor,
  });
  const merged = await orderRepository.findByRestaurantAndId(restaurantId, result.orderIds[0]!);
  assert.equal(merged?.items.length, 2);
  assert.equal(merged?.total, expectedTotal(merged!.items));
  assert.equal(merged?.events?.some((event) => event.type === "TABLES_MERGED"), true);
  assert.equal((await tableRepository.findByRestaurantAndId(restaurantId, `${restaurantId}-t2`))?.status, "OPEN");
  const source = await orderRepository.findRunningForTable(restaurantId, 2);
  assert.equal(source.length, 0);
  const { OrderModel } = await import("../../lib/db/models");
  const closed = await OrderModel.find({ restaurantId, tableNumber: 2 }).lean();
  assert.equal(closed[0]?.status, "MERGED");
  assert.equal(closed[0]?.mergedIntoOrderId, result.orderIds[0]);
  assert.notEqual(closed[0]?.status, "CANCELLED");
});

test("splitting by item or equally uses server amounts and does not collect payment", async () => {
  if (!enabled) return;
  const restaurantId = await seedPair("split");
  const order = await openOrder(restaurantId, 1, ["dal", "rice"]);
  const rice = order.items.find((item) => item.dishId.endsWith("-rice"));
  const { floorTransferService } = await import("../../lib/services/floor-transfer.service");
  const { orderRepository } = await import("../../lib/repositories/order.repository");
  const split = await floorTransferService.splitItems({
    restaurantId,
    tableId: `${restaurantId}-t1`,
    lineIds: [rice!.lineId!],
    idempotencyKey: randomUUID(),
    actor,
  });
  assert.equal(split.orderIds.length, 2);
  const bills = await Promise.all(split.orderIds.map((id) => orderRepository.findByRestaurantAndId(restaurantId, id)));
  for (const bill of bills) {
    assert.equal(bill?.total, expectedTotal(bill!.items));
    assert.equal(bill?.payment?.amountPaid ?? 0, 0);
    assert.notEqual(bill?.payment?.status, "PAID");
  }
  const combined = bills.reduce((sum, bill) => sum + (bill?.total ?? 0), 0);
  assert.equal(Math.round(combined * 100), Math.round(expectedTotal([...bills[0]!.items, ...bills[1]!.items]) * 100));

  const equal = await floorTransferService.splitEqual({
    restaurantId,
    tableId: `${restaurantId}-t1`,
    ways: 3,
    idempotencyKey: randomUUID(),
    actor,
  });
  const shareSum = (equal.shares ?? []).reduce((sum, share) => sum + share, 0);
  assert.equal(Math.round(shareSum * 100), Math.round((equal.total ?? 0) * 100));
  const after = await orderRepository.findByRestaurantAndId(restaurantId, equal.orderIds[0]!);
  assert.equal(after?.payment?.amountPaid ?? 0, 0);
  assert.equal(after?.events?.some((event) => event.type === "BILL_SPLIT" && event.meta?.paymentCollected === false), true);
});

test("voiding a KOT item needs a reason and follows the kitchen cancel rule", async () => {
  if (!enabled) return;
  const restaurantId = await seedPair("void");
  const order = await openOrder(restaurantId, 1, ["dal"]);
  const lineId = order.items[0]!.lineId!;
  const { floorTransferService } = await import("../../lib/services/floor-transfer.service");
  const { OrderServiceError } = await import("../../lib/services/order.service");
  const { orderRepository } = await import("../../lib/repositories/order.repository");

  await assert.rejects(
    () =>
      floorTransferService.requestVoid({
        restaurantId,
        tableId: `${restaurantId}-t1`,
        lineId,
        quantity: 1,
        reason: "no",
        idempotencyKey: randomUUID(),
        actor,
      }),
    (error: unknown) => error instanceof OrderServiceError,
  );

  const requested = await floorTransferService.requestVoid({
    restaurantId,
    tableId: `${restaurantId}-t1`,
    lineId,
    quantity: 1,
    reason: "Guest changed their mind",
    idempotencyKey: randomUUID(),
    actor,
  });
  const stillOpen = await orderRepository.findByRestaurantAndId(restaurantId, order.id);
  assert.equal(stillOpen?.items[0]?.cancelledQuantity ?? 0, 0);
  assert.equal(requested.pending, true);

  const manager: PaymentAuditActor = { role: "RESTAURANT_ADMIN", id: "mgr-1", name: "Manager" };
  const approved = await floorTransferService.approveVoid({
    restaurantId,
    approvalId: requested.approvalId,
    approver: manager,
  });
  assert.equal(approved.alreadyApproved, false);
  if (!approved.alreadyApproved) {
    assert.equal(approved.order.total, expectedTotal(approved.order.items));
    assert.equal(approved.approverId, "mgr-1");
    assert.match(approved.reason, /Guest changed their mind/);
  }
  const stored = await orderRepository.findByRestaurantAndId(restaurantId, order.id);
  assert.equal(stored?.events?.some((event) => event.type === "LINE_CANCELLED" && /Guest changed their mind/.test(event.message)), true);
  await assert.rejects(
    () => floorTransferService.approveVoid({ restaurantId, approvalId: requested.approvalId, approver: actor }),
    /manager or admin/i,
  );
});
