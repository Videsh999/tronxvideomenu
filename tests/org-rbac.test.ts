import assert from "node:assert/strict";
import test from "node:test";
import {
  assertOutletPermission,
  canAccessOutlet,
  resolveAccessibleOutletIds,
  roleHasPermission,
} from "../lib/org-rbac";

const orgOutlets = [
  { id: "outlet-a", organizationId: "org-1" },
  { id: "outlet-b", organizationId: "org-1" },
  { id: "outlet-x", organizationId: "org-2" },
];

test("org owner can access all org outlets but not other orgs", () => {
  const principal = {
    sessionRestaurantId: "outlet-a",
    account: {
      id: "acc-1",
      restaurantId: "outlet-a",
      organizationId: "org-1",
      orgRole: "ORG_OWNER" as const,
      outletIds: [],
    },
  };
  assert.deepEqual(resolveAccessibleOutletIds(principal, orgOutlets), ["outlet-a", "outlet-b"]);
  assert.equal(canAccessOutlet(principal, "outlet-x", orgOutlets), false);
  assert.equal(roleHasPermission("ORG_OWNER", "ORG_MENU_SYNC"), true);
});

test("outlet staff cannot receive purchase orders or sync menus", () => {
  assert.equal(roleHasPermission("OUTLET_STAFF", "OUTLET_PROCUREMENT_RECEIVE"), false);
  assert.equal(roleHasPermission("OUTLET_STAFF", "ORG_MENU_SYNC"), false);
  assert.equal(roleHasPermission("OUTLET_MANAGER", "OUTLET_PROCUREMENT_RECEIVE"), true);
});

test("legacy admin cannot cross outlets via manipulated ids", () => {
  const principal = {
    sessionRestaurantId: "outlet-a",
    account: null,
  };
  const denied = assertOutletPermission({
    principal,
    outletId: "outlet-b",
    permission: "OUTLET_INVENTORY_WRITE",
    orgOutlets,
  });
  assert.equal(denied.ok, false);
  if (!denied.ok) assert.equal(denied.status, 403);

  const allowed = assertOutletPermission({
    principal,
    outletId: "outlet-a",
    permission: "OUTLET_INVENTORY_WRITE",
    orgOutlets,
  });
  assert.equal(allowed.ok, true);
});

test("outlet manager limited to assigned outlets", () => {
  const principal = {
    sessionRestaurantId: "outlet-a",
    account: {
      id: "acc-2",
      restaurantId: "outlet-a",
      organizationId: "org-1",
      orgRole: "OUTLET_MANAGER" as const,
      outletIds: ["outlet-a"],
    },
  };
  assert.equal(canAccessOutlet(principal, "outlet-a", orgOutlets), true);
  assert.equal(canAccessOutlet(principal, "outlet-b", orgOutlets), false);
});
