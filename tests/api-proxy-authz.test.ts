import assert from "node:assert/strict";
import test from "node:test";
import { apiSessionAllowed, classifyApiRequest } from "../lib/api-authz";

test("captain sessions cannot satisfy admin or super-admin API classes", () => {
  const captain = { restaurantAdmin: false, superAdmin: false, captain: true };
  assert.equal(apiSessionAllowed("captain", captain), true);
  assert.equal(apiSessionAllowed("restaurant_admin", captain), false);
  assert.equal(apiSessionAllowed("super_admin", captain), false);
  assert.equal(apiSessionAllowed("staff", captain), false);
  assert.equal(apiSessionAllowed("floor", captain), true);
});

test("floor class covers POS create and order payment for captains", () => {
  assert.equal(classifyApiRequest("POST", "/api/pos/orders"), "floor");
  assert.equal(classifyApiRequest("POST", "/api/orders/abc/payment"), "floor");
  assert.equal(classifyApiRequest("POST", "/api/orders/abc/cancel-lines"), "floor");
  assert.equal(classifyApiRequest("GET", "/api/pos/orders"), "staff");
});

test("restaurant admin cannot satisfy super-admin API class", () => {
  const admin = { restaurantAdmin: true, superAdmin: false, captain: false };
  assert.equal(apiSessionAllowed("staff", admin), true);
  assert.equal(apiSessionAllowed("restaurant_admin", admin), true);
  assert.equal(apiSessionAllowed("super_admin", admin), false);
  assert.equal(apiSessionAllowed("captain", admin), false);
});

test("path classification separates public, captain, admin, and staff surfaces", () => {
  assert.equal(classifyApiRequest("POST", "/api/public/orders"), "public");
  assert.equal(classifyApiRequest("POST", "/api/dev/seed-demo-kitchen"), "public");
  assert.equal(classifyApiRequest("GET", "/api/orders/abc/status"), "public");
  assert.equal(classifyApiRequest("GET", "/api/captain/orders"), "captain");
  assert.equal(classifyApiRequest("GET", "/api/admin/captains"), "restaurant_admin");
  assert.equal(classifyApiRequest("GET", "/api/super-admin/restaurant-admins"), "super_admin");
  assert.equal(classifyApiRequest("POST", "/api/dishes"), "staff");
  assert.equal(classifyApiRequest("PATCH", "/api/orders/abc"), "staff");
  assert.equal(classifyApiRequest("GET", "/api/restaurants/moai-kitchen?fullMenu=true".split("?")[0]), "public");
});
