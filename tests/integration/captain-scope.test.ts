/**
 * Captain cookies, outlet scope, and customer details on captain order payloads.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { CAPTAIN_SESSION_COOKIE, createAdminSession } from "../../lib/auth-core";
import type { PaymentAuditActor } from "../../types";
import { connectReplicaSet, disconnectTestDatabase, integrationEnabled } from "./harness";

const enabled = integrationEnabled();
const actor: PaymentAuditActor = { role: "CAPTAIN", id: "cap-scope", name: "Captain" };

test.before(async () => {
  if (!enabled) return;
  await connectReplicaSet();
});

test.after(async () => {
  if (!enabled) return;
  await disconnectTestDatabase();
});

function withStaffCookie<T>(cookie: string, run: () => Promise<T>) {
  const requestCookies = new RequestCookies(new Headers({ cookie }));
  return workAsyncStorage.run({ route: "/api/captain", page: "/api/captain/route" } as never, () =>
    workUnitAsyncStorage.run({
      type: "request",
      phase: "render",
      cookies: requestCookies,
      implicitTags: { tags: [] },
      url: { pathname: "/api/captain/orders", search: "" },
    } as never, run),
  );
}

async function seed(label: string) {
  const { RestaurantModel, CategoryModel, DishModel, TableModel, CaptainModel, OrderModel } = await import("../../lib/db/models");
  const { orderService } = await import("../../lib/services/order.service");
  const id = `cs-${label}-${randomUUID()}`;
  const now = new Date().toISOString();
  await RestaurantModel.create({
    id,
    name: label,
    slug: id,
    isOpen: true,
    isActive: true,
    currency: "INR",
    subscriptionPlan: "ENTERPRISE",
    subscriptionEnabled: true,
    captainTableScope: "ALL",
    billing: { gstEnabled: false, taxRatePercent: 0, priceMode: "EXCLUSIVE", supplyType: "INTRA_STATE" },
    createdAt: now,
    updatedAt: now,
  });
  await CategoryModel.create({ id: `${id}-cat`, restaurantId: id, name: "Mains", sortOrder: 1, isActive: true, createdAt: now, updatedAt: now });
  await DishModel.create({
    id: `${id}-dal`,
    restaurantId: id,
    categoryId: `${id}-cat`,
    name: "Dal",
    price: 40,
    isVeg: true,
    isAvailable: true,
    sortOrder: 1,
    variants: [],
    createdAt: now,
    updatedAt: now,
  });
  await TableModel.create({ id: `${id}-t1`, restaurantId: id, tableNumber: 1, isActive: true, status: "OPEN", createdAt: now, updatedAt: now });
  await TableModel.create({ id: `${id}-t2`, restaurantId: id, tableNumber: 2, isActive: true, status: "OPEN", createdAt: now, updatedAt: now });
  const captainId = `${id}-cap`;
  await CaptainModel.create({
    id: captainId,
    restaurantId: id,
    name: "Demo Captain",
    email: `${captainId}@tronx.local`,
    passwordHash: "not-used",
    isActive: true,
    assignedTableIds: [`${id}-t1`],
    createdAt: now,
    updatedAt: now,
  });
  const order = await orderService.createPosOrder(id, id, {
    channel: "POS_DINE_IN",
    tableNumber: 1,
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${id}-dal`, quantity: 1, selections: [] }],
  }, actor);
  await OrderModel.updateOne({ id: order.id }, {
    $set: {
      customerName: "Asha Rao",
      customerPhone: "9999999999",
      customerEmail: "asha@example.com",
      deliveryAddress: "12 Lake Road",
    },
  });
  return { id, captainId, updatedAt: now, orderId: order.id };
}

test("captain scope and order payloads hide another outlet and customer contact details", async (t) => {
  if (!enabled) {
    t.skip("npm run test:integration starts the replica set");
    return;
  }
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "captain-scope-secret";
  const outletA = await seed("a");
  const outletB = await seed("b");
  const { captainService } = await import("../../lib/services/captain.service");
  const { RestaurantModel } = await import("../../lib/db/models");
  await assert.doesNotReject(() => captainService.assertCaptainMayServeTable(outletA.captainId, outletA.id, `${outletA.id}-t2`));
  await RestaurantModel.updateOne({ id: outletA.id }, { $set: { captainTableScope: "ASSIGNED" } });
  await assert.rejects(
    () => captainService.assertCaptainMayServeTable(outletA.captainId, outletA.id, `${outletA.id}-t2`),
    /not assigned/,
  );
  await assert.doesNotReject(() => captainService.assertCaptainMayServeTable(outletA.captainId, outletA.id, `${outletA.id}-t1`));

  const token = await createAdminSession(
    "captain-a@tronx.local",
    process.env.AUTH_SECRET,
    "CAPTAIN",
    outletA.id,
    outletA.id,
    outletA.captainId,
    outletA.updatedAt,
  );
  const cookie = `${CAPTAIN_SESSION_COOKIE}=${token}`;
  const { GET: getOrders } = await import("../../app/api/captain/orders/route");
  const { GET: getTables } = await import("../../app/api/captain/tables/route");
  const ordersResponse = await withStaffCookie(cookie, () => getOrders());
  assert.equal(ordersResponse.status, 200);
  const ordersBody = await ordersResponse.json() as { data: Array<Record<string, unknown>> };
  const row = ordersBody.data.find((entry) => entry.id === outletA.orderId);
  assert.ok(row);
  assert.equal(row?.customerName, "Asha");
  assert.equal("customerPhone" in (row ?? {}), false);
  assert.equal("customerEmail" in (row ?? {}), false);
  assert.equal("deliveryAddress" in (row ?? {}), false);
  assert.equal(ordersBody.data.some((entry) => entry.id === outletB.orderId), false);

  const tablesResponse = await withStaffCookie(cookie, () => getTables());
  const tablesBody = await tablesResponse.json() as { data: Array<{ id: string }> };
  assert.equal(tablesBody.data.some((table) => table.id.startsWith(outletB.id)), false);
});
