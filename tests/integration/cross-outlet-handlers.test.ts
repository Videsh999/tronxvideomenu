/**
 * Staff cookie from outlet A, calling the real order, dish, and customer handlers for outlet B.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { RequestCookies } from "next/dist/server/web/spec-extension/cookies";
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external";
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external";
import { createAdminSession, RESTAURANT_ADMIN_SESSION_COOKIE } from "../../lib/auth-core";
import type { PaymentAuditActor } from "../../types";
import { connectReplicaSet, disconnectTestDatabase, integrationEnabled } from "./harness";

const enabled = integrationEnabled();
const actor: PaymentAuditActor = { role: "RESTAURANT_ADMIN", id: "admin-scope", name: "Scope" };

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
  const workStore = { route: "/api/test", page: "/api/test/route" };
  const unit = {
    type: "request" as const,
    phase: "render" as const,
    cookies: requestCookies,
    implicitTags: { tags: [] as string[] },
    url: { pathname: "/api/test", search: "" },
  };
  return workAsyncStorage.run(workStore as never, () => workUnitAsyncStorage.run(unit as never, run));
}

async function seedOutlet(label: string) {
  const { RestaurantModel, CategoryModel, DishModel, CustomerProfileModel } = await import("../../lib/db/models");
  const { orderService } = await import("../../lib/services/order.service");
  const id = `scope-${label}-${randomUUID()}`;
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
    name: `${label} Dal`,
    price: 50,
    isVeg: true,
    isAvailable: true,
    sortOrder: 1,
    variants: [],
    createdAt: now,
    updatedAt: now,
  });
  await CustomerProfileModel.create({
    id: `${id}-cust`,
    restaurantId: id,
    phone: `90000${label.length}${randomUUID().slice(0, 4)}`,
    name: `${label} Guest`,
    loyaltyPoints: 0,
    totalOrders: 0,
    totalSpend: 0,
    createdAt: now,
    updatedAt: now,
  });
  const order = await orderService.createPosOrder(id, id, {
    channel: "POS_TAKEAWAY",
    idempotencyKey: randomUUID(),
    items: [{ dishId: `${id}-dal`, quantity: 1, selections: [] }],
  }, actor);
  return { id, orderId: order.id };
}

test("a staff cookie for one outlet cannot read another outlet's order, dishes, or customers", async (t) => {
  if (!enabled) {
    t.skip("npm run test:integration starts the replica set");
    return;
  }
  process.env.AUTH_SECRET = process.env.AUTH_SECRET || "cross-outlet-test-secret";
  const outletA = await seedOutlet("a");
  const outletB = await seedOutlet("b");
  const token = await createAdminSession("admin-a@tronx.local", process.env.AUTH_SECRET, "RESTAURANT_ADMIN", outletA.id, outletA.id);
  const cookie = `${RESTAURANT_ADMIN_SESSION_COOKIE}=${token}`;
  const { GET: getOrder } = await import("../../app/api/orders/[orderId]/route");
  const { GET: getDishes } = await import("../../app/api/dishes/route");
  const { GET: getCustomers } = await import("../../app/api/crm/customers/route");

  const foreignOrder = await withStaffCookie(cookie, () => getOrder(new Request("http://localhost/api/orders/" + outletB.orderId), {
    params: Promise.resolve({ orderId: outletB.orderId }),
  }));
  assert.equal(foreignOrder.status, 404);

  const ownOrder = await withStaffCookie(cookie, () => getOrder(new Request("http://localhost/api/orders/" + outletA.orderId), {
    params: Promise.resolve({ orderId: outletA.orderId }),
  }));
  assert.equal(ownOrder.status, 200);

  const foreignDishes = await withStaffCookie(cookie, () => getDishes(new Request(`http://localhost/api/dishes?restaurantId=${outletB.id}`)));
  assert.equal(foreignDishes.status, 404);
  const dishBody = await foreignDishes.json() as { data?: unknown };
  assert.equal(dishBody.data, undefined);

  const foreignCustomers = await withStaffCookie(cookie, () => getCustomers(new Request(`http://localhost/api/crm/customers?restaurantId=${outletB.id}`)));
  assert.equal(foreignCustomers.status, 404);
  const customerBody = await foreignCustomers.json() as { data?: unknown };
  assert.equal(customerBody.data, undefined);
});
