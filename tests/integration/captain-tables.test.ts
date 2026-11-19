/**
 * Captain floor: open a table, append a KOT, and keep the bill on calculateRestaurantBill.
 * A captain query for one outlet never returns another outlet's tables.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { calculateRestaurantBill } from "../../lib/billing/calculate-bill";
import type { PaymentAuditActor } from "../../types";
import { connectReplicaSet, disconnectTestDatabase, integrationEnabled } from "./harness";

const actor: PaymentAuditActor = { role: "CAPTAIN", id: "cap-int", name: "Captain" };
const enabled = integrationEnabled();

test.before(async () => {
  if (!enabled) return;
  await connectReplicaSet();
});

test.after(async () => {
  if (!enabled) return;
  await disconnectTestDatabase();
});

async function seedOutlet(label: string) {
  const { RestaurantModel, CategoryModel, DishModel, TableModel } = await import("../../lib/db/models");
  const id = `cap-${label}-${randomUUID()}`;
  const now = new Date().toISOString();
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
  await TableModel.create({
    id: `${id}-t1`,
    restaurantId: id,
    tableNumber: 1,
    area: "Indoor",
    capacity: 4,
    isActive: true,
    status: "OPEN",
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

test("opening a table, appending a KOT, and the stored total match the bill calculator", async () => {
  if (!enabled) return;
  const restaurantId = await seedOutlet("floor");
  const { tableService } = await import("../../lib/services/table.service");
  const { orderService } = await import("../../lib/services/order.service");
  const { tableRepository } = await import("../../lib/repositories/table.repository");

  const before = await tableService.list(restaurantId);
  const table = before[0]!;
  const opened = await tableRepository.setFloorStatus(restaurantId, table.id, "OCCUPIED", {
    guestCount: 3,
    occupiedSince: new Date().toISOString(),
  });
  assert.equal(opened?.guestCount, 3);
  assert.ok(opened?.occupiedSince);

  const first = await orderService.createPosOrder(
    restaurantId,
    restaurantId,
    {
      channel: "POS_DINE_IN",
      tableNumber: 1,
      guestCount: 3,
      idempotencyKey: randomUUID(),
      items: [{ dishId: `${restaurantId}-dal`, quantity: 2, selections: [] }],
    },
    actor,
  );
  assert.equal(first.items[0]?.kotNumber, 1);

  const second = await orderService.appendItemsToOrder(
    restaurantId,
    restaurantId,
    first.id,
    {
      idempotencyKey: randomUUID(),
      items: [{ dishId: `${restaurantId}-rice`, quantity: 1, selections: [] }],
    },
    actor,
  );
  const rice = second.items.find((item) => item.dishId.endsWith("-rice"));
  assert.equal(rice?.kotNumber, 2);
  assert.equal(second.items.find((item) => item.dishId.endsWith("-dal"))?.kotNumber, 1);

  const expected = calculateRestaurantBill({
    lines: second.items.map((item) => ({
      lineTotal: item.itemTotal,
      quantity: item.quantity,
      gstRatePercent: item.gstRateSnapshot ?? 5,
    })),
    billDiscountAmount: 0,
    billing: {
      gstEnabled: true,
      gstRatePercent: 5,
      taxRatePercent: 5,
      taxLabel: "GST",
      priceMode: "EXCLUSIVE",
      supplyType: "INTRA_STATE",
      packagingEnabled: false,
      serviceChargeEnabled: false,
    },
  });
  assert.equal(second.total, expected.total);
  assert.equal(second.subtotal, expected.itemsSubtotal);
});

test("one outlet's tables are not visible when listing another outlet", async () => {
  if (!enabled) return;
  const outletA = await seedOutlet("a");
  const outletB = await seedOutlet("b");
  const { tableService } = await import("../../lib/services/table.service");
  const visibleToA = await tableService.list(outletA);
  assert.equal(visibleToA.length, 1);
  assert.equal(visibleToA[0]?.restaurantId, outletA);
  assert.equal(visibleToA.some((table) => table.restaurantId === outletB), false);
  const visibleToB = await tableService.list(outletB);
  assert.equal(visibleToB.some((table) => table.id === visibleToA[0]?.id), false);
});
