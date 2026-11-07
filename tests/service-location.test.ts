import assert from "node:assert/strict";
import test from "node:test";
import type { RestaurantTable } from "../types/index";
import { createTableSchema, placeOrderSchema } from "../lib/validations/index";
import { locationMenuUrl, locationName, locationType } from "../lib/service-location";

const base = {
  id: "location-1",
  restaurantId: "restaurant-1",
  tableNumber: 204,
  capacity: 2,
  isActive: true,
  status: "OPEN" as const,
  createdAt: "2026-11-07T00:00:00.000Z",
  updatedAt: "2026-11-07T00:00:00.000Z",
};

test("legacy locations remain dining tables", () => {
  const legacy: RestaurantTable = base;
  assert.equal(locationType(legacy), "TABLE");
  assert.equal(locationName(legacy), "Table 204");
  assert.equal(locationMenuUrl("https://menu.test", "hotel", legacy), "https://menu.test/menu/hotel?table=204");
});

test("rooms have a distinct label and QR query", () => {
  const room: RestaurantTable = { ...base, locationType: "ROOM" };
  assert.equal(locationName(room), "Room 204");
  assert.equal(locationMenuUrl("https://menu.test", "hotel", room), "https://menu.test/menu/hotel?room=204");
});

test("table input defaults legacy clients to TABLE and accepts ROOM", () => {
  assert.equal(createTableSchema.parse({ tableNumber: 1, capacity: 4 }).locationType, "TABLE");
  assert.equal(createTableSchema.parse({ locationType: "ROOM", tableNumber: 101, capacity: 2 }).locationType, "ROOM");
});

test("public room orders carry their location type through validation", () => {
  const parsed = placeOrderSchema.parse({
    slug: "hotel",
    locationType: "ROOM",
    tableNumber: 204,
    idempotencyKey: "7e645a82-982c-4e20-9bb7-19309f0bd945",
    items: [{ dishId: "dish-1", quantity: 1, expectedUnitPrice: 100, selections: [] }],
  });
  assert.equal(parsed.locationType, "ROOM");
});
