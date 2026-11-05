/**
 * Real MongoDB concurrency / multi-document integration suite.
 *
 * Requires a replica set (transactions) and:
 *   RUN_INTEGRATION=1 MONGODB_URI=mongodb://... npm run test:integration
 *
 * See docs/MONGO_REPLICA_SET_TESTING.md for local Docker / Atlas setup.
 *
 * These tests are skipped (not mocked) when the environment is unavailable.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";

const enabled = process.env.RUN_INTEGRATION === "1" && Boolean(process.env.MONGODB_URI);

function skipReason() {
  return "Set RUN_INTEGRATION=1 and MONGODB_URI to a MongoDB replica set to run concurrency tests.";
}

async function connect() {
  const uri = process.env.MONGODB_URI!;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
}

test("concurrent coupon maxRedemptions: at most one of 20 succeeds when limit=1", async (t) => {
  if (!enabled) {
    t.skip(skipReason());
    return;
  }
  await connect();
  const { crmRepository } = await import("../../lib/repositories/crm.repository");
  const restaurantId = `int-rest-${randomUUID()}`;
  const coupon = await crmRepository.createCoupon({
    id: `coupon-${randomUUID()}`,
    restaurantId,
    code: `RACE${randomUUID().slice(0, 6).toUpperCase()}`,
    discountType: "FIXED",
    discountValue: 10,
    maxRedemptions: 1,
    redemptionCount: 0,
    isActive: true,
  });

  const results = await Promise.all(
    Array.from({ length: 20 }, (_, index) =>
      crmRepository.atomicReserveCouponRedemption({
        restaurantId,
        couponId: coupon.id,
        orderId: `order-${index}-${randomUUID()}`,
        idempotencyKey: `ikey-${index}-${randomUUID()}`,
        discountAmount: 10,
        codeSnapshot: coupon.code,
      }),
    ),
  );

  const ok = results.filter((result) => result.ok);
  assert.equal(ok.length, 1, `expected exactly 1 success, got ${ok.length}`);
  const refreshed = await crmRepository.getCouponById(restaurantId, coupon.id);
  assert.equal(refreshed?.redemptionCount, 1);
  await mongoose.disconnect();
});

test("concurrent loyalty redeem cannot overdraw points", async (t) => {
  if (!enabled) {
    t.skip(skipReason());
    return;
  }
  await connect();
  const { crmRepository } = await import("../../lib/repositories/crm.repository");
  const restaurantId = `int-rest-${randomUUID()}`;
  const customer = await crmRepository.upsertCustomer({
    id: `cust-${randomUUID()}`,
    restaurantId,
    phone: `9${Date.now().toString().slice(-9)}`,
    segment: "NEW",
    loyaltyPoints: 10,
    totalOrders: 0,
    totalSpend: 0,
    marketingOptIn: false,
    smsOptIn: false,
    emailOptIn: false,
  });

  const outcomes = await Promise.allSettled(
    Array.from({ length: 10 }, (_, index) =>
      crmRepository.applyLoyalty({
        restaurantId,
        customerId: customer.id,
        kind: "REDEEM",
        points: 10,
        orderId: `o-${index}`,
        idempotencyKey: `loy-race-${index}-${randomUUID()}`,
      }),
    ),
  );

  const fulfilled = outcomes.filter((o) => o.status === "fulfilled");
  assert.equal(fulfilled.length, 1, `expected 1 redeem success, got ${fulfilled.length}`);
  const again = await crmRepository.getCustomer(restaurantId, customer.id);
  assert.equal(again?.loyaltyPoints, 0);
  await mongoose.disconnect();
});

test("duplicate purchase receipt idempotency key does not double stock", async (t) => {
  if (!enabled) {
    t.skip(skipReason());
    return;
  }
  await connect();
  const { inventoryRepository } = await import("../../lib/repositories/inventory.repository");
  const restaurantId = `int-rest-${randomUUID()}`;
  const ingredientId = `ing-${randomUUID()}`;
  await inventoryRepository.createIngredient({
    id: ingredientId,
    restaurantId,
    name: "Flour",
    baseUnit: "g",
    conversions: {},
    quantityOnHand: 0,
    isActive: true,
  });

  const key = `recv:gr-dup:${ingredientId}`;
  const first = await inventoryRepository.applyMovement({
    restaurantId,
    ingredientId,
    kind: "PURCHASE_RECEIPT",
    quantityDelta: 100,
    idempotencyKey: key,
    referenceType: "PURCHASE_ORDER",
    referenceId: "po-1",
  });
  const second = await inventoryRepository.applyMovement({
    restaurantId,
    ingredientId,
    kind: "PURCHASE_RECEIPT",
    quantityDelta: 100,
    idempotencyKey: key,
    referenceType: "PURCHASE_ORDER",
    referenceId: "po-1",
  });
  assert.equal(first.id, second.id);
  const ingredient = await inventoryRepository.getIngredient(restaurantId, ingredientId);
  assert.equal(ingredient?.quantityOnHand, 100);
  await mongoose.disconnect();
});

test("atomic stock consume: last unit wins once under concurrency", async (t) => {
  if (!enabled) {
    t.skip(skipReason());
    return;
  }
  await connect();
  const { inventoryRepository } = await import("../../lib/repositories/inventory.repository");
  const restaurantId = `int-rest-${randomUUID()}`;
  const ingredientId = `ing-${randomUUID()}`;
  await inventoryRepository.createIngredient({
    id: ingredientId,
    restaurantId,
    name: "Last Unit",
    baseUnit: "pcs",
    conversions: {},
    quantityOnHand: 1,
    isActive: true,
  });

  const outcomes = await Promise.allSettled(
    Array.from({ length: 8 }, (_, index) =>
      inventoryRepository.applyMovement({
        restaurantId,
        ingredientId,
        kind: "SALE_CONSUMPTION",
        quantityDelta: -1,
        idempotencyKey: `consume-race-${index}-${randomUUID()}`,
        referenceType: "ORDER",
        referenceId: `order-${index}`,
        enforceStock: true,
      }),
    ),
  );

  const ok = outcomes.filter((o) => o.status === "fulfilled");
  assert.equal(ok.length, 1, `expected exactly 1 consume, got ${ok.length}`);
  const ingredient = await inventoryRepository.getIngredient(restaurantId, ingredientId);
  assert.equal(ingredient?.quantityOnHand, 0);
  await mongoose.disconnect();
});
