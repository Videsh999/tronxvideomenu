/**
 * Order money on a real replica set: one bill writer, snapshots, idempotency,
 * optimistic version checks, and crash-retry of line cancellation.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { billFromStoredLines } from "../../lib/billing/order-bill";
import { calculateRestaurantBill } from "../../lib/billing/calculate-bill";
import { roundMoney } from "../../lib/order-pricing";
import type { PaymentAuditActor } from "../../types";
import { connectReplicaSet, disconnectTestDatabase, integrationEnabled } from "./harness";

const actor: PaymentAuditActor = { role: "RESTAURANT_ADMIN", id: "admin-int", name: "Integration" };
const enabled = integrationEnabled();

test.before(async () => {
  if (!enabled) return;
  await connectReplicaSet();
});

test.after(async () => {
  if (!enabled) return;
  await disconnectTestDatabase();
});

async function seedOutlet(priceMode: "EXCLUSIVE" | "INCLUSIVE" = "EXCLUSIVE") {
  const { RestaurantModel, CategoryModel, DishModel, TableModel } = await import("../../lib/db/models");
  const id = `int-${randomUUID()}`;
  const now = new Date().toISOString();
  const billing = {
    gstEnabled: true,
    gstRatePercent: 5,
    taxRatePercent: 5,
    taxLabel: "GST",
    priceMode,
    supplyType: "INTRA_STATE" as const,
    packagingEnabled: true,
    packagingMethod: "PER_ORDER" as const,
    packagingAmount: 10,
    serviceChargeEnabled: true,
    serviceChargeType: "FIXED" as const,
    serviceChargeAmount: 5,
  };
  await RestaurantModel.create({
    id,
    name: "Integration Kitchen",
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
    id: `${id}-plain`,
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
    id: `${id}-sized`,
    restaurantId: id,
    categoryId: `${id}-cat`,
    name: "Biryani",
    price: 300,
    isVeg: true,
    isAvailable: true,
    sortOrder: 2,
    variants: [
      { id: "half", name: "Half", price: 160, isAvailable: true },
      { id: "full", name: "Full", price: 300, isAvailable: true },
    ],
    createdAt: now,
    updatedAt: now,
  });
  await DishModel.create({
    id: `${id}-side`,
    restaurantId: id,
    categoryId: `${id}-cat`,
    name: "Rice",
    price: 40,
    isVeg: true,
    isAvailable: true,
    sortOrder: 3,
    taxRatePercent: 12,
    variants: [],
    createdAt: now,
    updatedAt: now,
  });
  await TableModel.create({
    id: `${id}-t1`,
    restaurantId: id,
    tableNumber: 1,
    capacity: 4,
    isActive: true,
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
  });
  return { id, billing };
}

test("QR variant price, idempotent resubmit, and inclusive tax is not added twice", async (t) => {
  if (!enabled) {
    t.skip("npm run test:integration starts the replica set");
    return;
  }
  const { orderService } = await import("../../lib/services/order.service");
  const { id, billing } = await seedOutlet("INCLUSIVE");
  const key = randomUUID();
  const first = await orderService.createPublic({
    slug: id,
    tableNumber: 1,
    idempotencyKey: key,
    items: [{
      dishId: `${id}-sized`,
      variantId: "half",
      quantity: 1,
      expectedUnitPrice: 160,
      selections: [],
    }],
  });
  assert.equal(first.order.items[0]?.unitPriceSnapshot, 160);
  assert.equal(first.order.items[0]?.variantNameSnapshot, "Half");
  const second = await orderService.createPublic({
    slug: id,
    tableNumber: 1,
    idempotencyKey: key,
    items: [{
      dishId: `${id}-sized`,
      variantId: "half",
      quantity: 1,
      expectedUnitPrice: 160,
      selections: [],
    }],
  });
  assert.equal(second.duplicate, true);
  assert.equal(second.order.id, first.order.id);
  await assert.rejects(
    () => orderService.createPublic({
      slug: id,
      tableNumber: 1,
      idempotencyKey: randomUUID(),
      items: [{ dishId: `${id}-sized`, quantity: 1, expectedUnitPrice: 300, selections: [] }],
    }),
    /Select a variant/,
  );

  const expected = calculateRestaurantBill({
    lines: [{ lineTotal: 160, quantity: 1, gstRatePercent: 5 }],
    billing,
  });
  assert.equal(first.order.total, expected.total);
  assert.ok(expected.taxAmount > 0);
  assert.notEqual(first.order.total, roundMoney(expected.taxableAmount + expected.taxAmount + expected.taxAmount));
});

test("append keeps historical line snapshots; concurrent appends both land", async (t) => {
  if (!enabled) {
    t.skip("npm run test:integration starts the replica set");
    return;
  }
  const { orderService } = await import("../../lib/services/order.service");
  const { DishModel } = await import("../../lib/db/models");
  const { orderRepository } = await import("../../lib/repositories/order.repository");
  const { id } = await seedOutlet();
  const created = await orderService.createPosOrder(id, id, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${id}-plain`, quantity: 1, selections: [] }],
  }, actor);
  await DishModel.updateOne({ id: `${id}-plain` }, { $set: { price: 999, taxRatePercent: 18 } });
  const [left, right] = await Promise.all([
    orderService.appendItemsToOrder(id, id, created.id, {
      idempotencyKey: randomUUID(),
      items: [{ dishId: `${id}-side`, quantity: 1, selections: [] }],
    }, actor),
    orderService.appendItemsToOrder(id, id, created.id, {
      idempotencyKey: randomUUID(),
      items: [{ dishId: `${id}-side`, quantity: 1, selections: [] }],
    }, actor),
  ]);
  assert.ok(left.id === created.id && right.id === created.id);
  const stored = await orderRepository.findByRestaurantAndId(id, created.id);
  assert.ok(stored);
  assert.equal(stored!.items.length, 3);
  const original = stored!.items.find((item) => item.dishId === `${id}-plain`);
  assert.equal(original?.unitPriceSnapshot, 100);
  assert.equal(original?.gstRateSnapshot, 5);
  const retryKey = randomUUID();
  const once = await orderService.appendItemsToOrder(id, id, created.id, {
    idempotencyKey: retryKey,
    items: [{ dishId: `${id}-plain`, quantity: 1, selections: [] }],
  }, actor);
  const twice = await orderService.appendItemsToOrder(id, id, created.id, {
    idempotencyKey: retryKey,
    items: [{ dishId: `${id}-plain`, quantity: 1, selections: [] }],
  }, actor);
  assert.equal(twice.items.length, once.items.length);
});

test("cancel retries, concurrent cancels, and a crash before totals are safe", async (t) => {
  if (!enabled) {
    t.skip("npm run test:integration starts the replica set");
    return;
  }
  const { orderService } = await import("../../lib/services/order.service");
  const { orderRepository } = await import("../../lib/repositories/order.repository");
  const { OrderLineCancellationModel } = await import("../../lib/db/models");
  const { id, billing } = await seedOutlet();
  const created = await orderService.createPosOrder(id, id, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [
      { dishId: `${id}-plain`, quantity: 2, selections: [] },
      { dishId: `${id}-side`, quantity: 1, selections: [] },
    ],
  }, actor);
  const [lineA, lineB] = created.items;
  assert.ok(lineA?.lineId && lineB?.lineId);
  await Promise.all([
    orderService.cancelOrderLines(id, created.id, {
      lines: [{ lineId: lineA!.lineId!, quantity: 1 }],
      reason: "guest changed mind",
      idempotencyKey: randomUUID(),
      actor,
    }),
    orderService.cancelOrderLines(id, created.id, {
      lines: [{ lineId: lineB!.lineId!, quantity: 1 }],
      reason: "kitchen 86",
      idempotencyKey: randomUUID(),
      actor,
    }),
  ]);
  const afterRace = await orderRepository.findByRestaurantAndId(id, created.id);
  assert.ok(afterRace);
  assert.equal(afterRace!.items.find((item) => item.lineId === lineA!.lineId)?.cancelledQuantity, 1);
  assert.equal(afterRace!.items.find((item) => item.lineId === lineB!.lineId)?.cancelledQuantity, 1);
  const expected = billFromStoredLines({
    items: afterRace!.items,
    billing,
    historicalBill: afterRace!.billSnapshot,
    orderTaxRatePercent: afterRace!.taxRatePercent,
  });
  assert.equal(afterRace!.total, expected.total);
  assert.equal(afterRace!.cgstAmount, expected.cgstAmount);
  assert.equal(afterRace!.sgstAmount, expected.sgstAmount);
  assert.equal(afterRace!.igstAmount, expected.igstAmount);
  assert.equal(afterRace!.packagingCharge, expected.packagingCharge);
  assert.equal(afterRace!.serviceCharge, expected.serviceCharge);
  assert.deepEqual(afterRace!.billSnapshot?.total, expected.total);

  const retryKey = randomUUID();
  const firstCancel = await orderService.cancelOrderLines(id, created.id, {
    lines: [{ lineId: lineA!.lineId!, quantity: 1 }],
    reason: "second portion",
    idempotencyKey: retryKey,
    actor,
  });
  const duplicate = await orderService.cancelOrderLines(id, created.id, {
    lines: [{ lineId: lineA!.lineId!, quantity: 1 }],
    reason: "second portion",
    idempotencyKey: retryKey,
    actor,
  });
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.order.items.find((item) => item.lineId === lineA!.lineId)?.cancelledQuantity, firstCancel.order.items.find((item) => item.lineId === lineA!.lineId)?.cancelledQuantity);

  const crashKey = randomUUID();
  const fresh = await orderService.createPosOrder(id, id, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${id}-plain`, quantity: 2, selections: [] }],
  }, actor);
  const crashLine = fresh.items[0]!.lineId!;
  await OrderLineCancellationModel.create({
    id: `olc-parent-${randomUUID()}`,
    restaurantId: id,
    orderId: fresh.id,
    orderLineId: "*",
    quantityCancelled: 1,
    reason: "crash before totals",
    inventoryRestoreStatus: "NONE",
    idempotencyKey: crashKey,
    actor,
    createdAt: new Date().toISOString(),
    applyStatus: "PENDING",
    baseVersion: 0,
    plannedCancelled: { [crashLine]: 1 },
  });
  const recovered = await orderService.cancelOrderLines(id, fresh.id, {
    lines: [{ lineId: crashLine, quantity: 1 }],
    reason: "crash before totals",
    idempotencyKey: crashKey,
    actor,
  });
  assert.equal(recovered.order.items[0]?.cancelledQuantity, 1);
  const recoveredAgain = await orderService.cancelOrderLines(id, fresh.id, {
    lines: [{ lineId: crashLine, quantity: 1 }],
    reason: "crash before totals",
    idempotencyKey: crashKey,
    actor,
  });
  assert.equal(recoveredAgain.duplicate, true);
  assert.equal(recoveredAgain.order.items[0]?.cancelledQuantity, 1);
  const marker = await OrderLineCancellationModel.findOne({ restaurantId: id, idempotencyKey: crashKey }).lean();
  assert.equal(marker?.applyStatus, "APPLIED");
});

test("concurrent payments do not lose updates and a retry key is applied once", async (t) => {
  if (!enabled) {
    t.skip("npm run test:integration starts the replica set");
    return;
  }
  const { orderService } = await import("../../lib/services/order.service");
  const { id } = await seedOutlet();
  const created = await orderService.createPosOrder(id, id, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${id}-plain`, quantity: 2, selections: [] }],
  }, actor);
  const half = roundMoney(created.total / 2);
  const rest = roundMoney(created.total - half);
  const settled = await Promise.all([
    orderService.recordPayment(id, created.id, "CASH", actor, half, `pay-${randomUUID()}`),
    orderService.recordPayment(id, created.id, "UPI", actor, rest, `pay-${randomUUID()}`),
  ]);
  const paid = settled.reduce((max, order) => ((order.payment.ledger?.length ?? 0) > (max.payment.ledger?.length ?? 0) ? order : max));
  assert.equal(paid.payment.amountPaid, created.total);
  assert.equal(paid.payment.ledger?.length, 2);
  assert.equal(paid.payment.status, "PAID");

  const retryOrder = await orderService.createPosOrder(id, id, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${id}-side`, quantity: 1, selections: [] }],
  }, actor);
  const key = `pay-${randomUUID()}`;
  const once = await orderService.recordPayment(id, retryOrder.id, "CARD", actor, undefined, key);
  const twice = await orderService.recordPayment(id, retryOrder.id, "CARD", actor, undefined, key);
  assert.equal(twice.payment.ledger?.length, 1);
  assert.equal(twice.payment.amountPaid, once.payment.amountPaid);
  await assert.rejects(
    () => orderService.recordPayment(id, retryOrder.id, "CASH", actor, 1, `pay-${randomUUID()}`),
    /already/,
  );

  const shared = `pay-${randomUUID()}`;
  const raced = await orderService.createPosOrder(id, id, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${id}-plain`, quantity: 1, selections: [] }],
  }, actor);
  const [firstPay, secondPay] = await Promise.all([
    orderService.recordPayment(id, raced.id, "CASH", actor, undefined, shared),
    orderService.recordPayment(id, raced.id, "UPI", actor, undefined, shared),
  ]);
  assert.equal(firstPay.payment.ledger?.length, 1);
  assert.equal(secondPay.payment.ledger?.length, 1);
  assert.equal(firstPay.payment.amountPaid, secondPay.payment.amountPaid);
});

test("a crash after the totals write rolls back, and a full cancel retries cleanly", async (t) => {
  if (!enabled) {
    t.skip("npm run test:integration starts the replica set");
    return;
  }
  const { orderService } = await import("../../lib/services/order.service");
  const { orderRepository } = await import("../../lib/repositories/order.repository");
  const { OrderLineCancellationModel } = await import("../../lib/db/models");
  const { id } = await seedOutlet();
  const created = await orderService.createPosOrder(id, id, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${id}-plain`, quantity: 2, selections: [] }],
  }, actor);
  const before = await orderRepository.findByRestaurantAndId(id, created.id);
  assert.ok(before);
  const session = await mongoose.startSession();
  session.startTransaction();
  const staged = await orderRepository.replaceItemsAndTotals(id, created.id, {
    items: before!.items.map((item) => ({ ...item, cancelledQuantity: item.quantity, itemTotal: 0 })),
    subtotal: 0,
    taxAmount: 0,
    total: 0,
    event: {
      id: `evt-${randomUUID()}`,
      type: "LINE_CANCELLED",
      at: new Date().toISOString(),
      message: "staged crash",
    },
    expectedVersion: before!.version ?? 0,
    session,
  });
  assert.ok(staged);
  await session.abortTransaction();
  await session.endSession();
  const afterAbort = await orderRepository.findByRestaurantAndId(id, created.id);
  assert.equal(afterAbort?.total, before!.total);
  assert.equal(afterAbort?.items[0]?.cancelledQuantity ?? 0, 0);

  const key = randomUUID();
  const lineId = created.items[0]!.lineId!;
  const full = await orderService.cancelOrderLines(id, created.id, {
    lines: [{ lineId, quantity: 2 }],
    reason: "guest left",
    idempotencyKey: key,
    actor,
  });
  assert.equal(full.order.status, "CANCELLED");
  const marker = await OrderLineCancellationModel.findOne({ restaurantId: id, idempotencyKey: key }).lean();
  assert.equal(marker?.applyStatus, "APPLIED");
  const again = await orderService.cancelOrderLines(id, created.id, {
    lines: [{ lineId, quantity: 2 }],
    reason: "guest left",
    idempotencyKey: key,
    actor,
  });
  assert.equal(again.duplicate, true);
  assert.equal(again.order.status, "CANCELLED");
  assert.equal(again.order.total, full.order.total);

  const split = await orderService.createPosOrder(id, id, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${id}-plain`, quantity: 2, selections: [] }],
  }, actor);
  const splitLine = split.items[0]!.lineId!;
  await Promise.all([
    orderService.cancelOrderLines(id, split.id, {
      lines: [{ lineId: splitLine, quantity: 1 }],
      reason: "one guest",
      idempotencyKey: randomUUID(),
      actor,
    }),
    orderService.cancelOrderLines(id, split.id, {
      lines: [{ lineId: splitLine, quantity: 1 }],
      reason: "other guest",
      idempotencyKey: randomUUID(),
      actor,
    }),
  ]);
  const both = await orderRepository.findByRestaurantAndId(id, split.id);
  assert.equal(both?.items[0]?.cancelledQuantity, 2);
  assert.equal(both?.status, "CANCELLED");
});

test("kitchen prep and an append do not wipe each other", async (t) => {
  if (!enabled) {
    t.skip("npm run test:integration starts the replica set");
    return;
  }
  const { orderService } = await import("../../lib/services/order.service");
  const { orderRepository } = await import("../../lib/repositories/order.repository");
  const { id } = await seedOutlet();
  const created = await orderService.createPosOrder(id, id, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${id}-plain`, quantity: 1, selections: [] }],
  }, actor);
  const lineId = created.items[0]!.lineId!;
  await Promise.all([
    (async () => {
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const current = await orderRepository.findByRestaurantAndId(id, created.id);
        const updated = await orderRepository.updateItemPreparation(
          id,
          created.id,
          lineId,
          "PREPARING",
          {
            id: `evt-${randomUUID()}`,
            type: "ITEM_PREP",
            at: new Date().toISOString(),
            message: "prep",
          },
          current?.version ?? 0,
        );
        if (updated) return;
      }
      throw new Error("preparation update lost the version race");
    })(),
    orderService.appendItemsToOrder(id, id, created.id, {
      idempotencyKey: randomUUID(),
      items: [{ dishId: `${id}-side`, quantity: 1, selections: [] }],
    }, actor),
  ]);
  const stored = await orderRepository.findByRestaurantAndId(id, created.id);
  assert.equal(stored?.items.length, 2);
  assert.equal(stored?.items.find((item) => item.lineId === lineId)?.preparationStatus, "PREPARING");
});
