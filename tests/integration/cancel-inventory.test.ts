/**
 * Inventory restore is recorded on the cancellation and can be retried.
 * A full cancel uses the whole-order restore.
 */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { randomUUID } from "node:crypto";
import type { PaymentAuditActor } from "../../types";
import { connectReplicaSet, disconnectTestDatabase, integrationEnabled } from "./harness";

const actor: PaymentAuditActor = { role: "RESTAURANT_ADMIN", id: "admin-inv", name: "Inventory" };
const enabled = integrationEnabled();

test.before(async () => {
  if (!enabled) return;
  await connectReplicaSet();
});

test.after(async () => {
  if (!enabled) return;
  await disconnectTestDatabase();
});

async function seedKitchen() {
  const { RestaurantModel, CategoryModel, DishModel } = await import("../../lib/db/models");
  const id = `inv-${randomUUID()}`;
  const now = new Date().toISOString();
  await RestaurantModel.create({
    id,
    name: "Inventory Kitchen",
    slug: id,
    isOpen: true,
    isActive: true,
    currency: "INR",
    subscriptionPlan: "ENTERPRISE",
    subscriptionEnabled: true,
    billing: { gstEnabled: false, taxRatePercent: 0, priceMode: "EXCLUSIVE", supplyType: "INTRA_STATE" },
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
    price: 80,
    isVeg: true,
    isAvailable: true,
    sortOrder: 1,
    variants: [],
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

test("full cancel restores the whole order and a failed restore can be retried", async (t) => {
  if (!enabled) {
    t.skip("npm run test:integration starts the replica set");
    return;
  }
  const restaurantId = await seedKitchen();
  const { orderService } = await import("../../lib/services/order.service");
  const { inventoryService } = await import("../../lib/services/inventory.service");
  const { OrderLineCancellationModel } = await import("../../lib/db/models");
  const fullRestore = mock.method(inventoryService, "maybeRestoreForCancelledOrder", async () => ({ skipped: true as const }));
  const lineRestore = mock.method(inventoryService, "restoreForCancelledLines", async () => ({ skipped: true as const }));

  const partial = await orderService.createPosOrder(restaurantId, restaurantId, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${restaurantId}-dal`, quantity: 2, selections: [] }],
  }, actor);
  await orderService.cancelOrderLines(restaurantId, partial.id, {
    lines: [{ lineId: partial.items[0]!.lineId!, quantity: 1 }],
    reason: "one plate back",
    idempotencyKey: randomUUID(),
    actor,
  });
  assert.equal(lineRestore.mock.calls.length, 1);
  assert.equal(fullRestore.mock.calls.length, 0);

  const created = await orderService.createPosOrder(restaurantId, restaurantId, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${restaurantId}-dal`, quantity: 1, selections: [] }],
  }, actor);
  fullRestore.mock.mockImplementation(async () => {
    throw new Error("stock service down");
  });
  const key = randomUUID();
  await assert.rejects(
    () => orderService.cancelOrderLines(restaurantId, created.id, {
      lines: [{ lineId: created.items[0]!.lineId!, quantity: 1 }],
      reason: "guest left",
      idempotencyKey: key,
      actor,
    }),
    /stock service down/,
  );
  const failed = await OrderLineCancellationModel.findOne({ restaurantId, idempotencyKey: key }).lean();
  assert.equal(failed?.applyStatus, "APPLIED");
  assert.equal(failed?.inventoryRestoreStatus, "FAILED");

  fullRestore.mock.mockImplementation(async () => ({ skipped: true as const, blocked: false as const }));
  const retried = await orderService.retryInventoryRestores(restaurantId, created.id);
  assert.equal(retried[0]?.status, "APPLIED");
  const restored = await OrderLineCancellationModel.findOne({ restaurantId, idempotencyKey: key }).lean();
  assert.equal(restored?.inventoryRestoreStatus, "APPLIED");
  assert.ok(fullRestore.mock.calls.length >= 2);

  fullRestore.mock.restore();
  lineRestore.mock.restore();
});
