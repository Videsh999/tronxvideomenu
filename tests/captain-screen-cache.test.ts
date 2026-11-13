import assert from "node:assert/strict";
import test from "node:test";
import { captainScreenTitle } from "../lib/captain-screen-cache";

test("captain button paths open with a real screen name", () => {
  assert.equal(captainScreenTitle("/captain/triparna-kitchen/tables"), "Tables");
  assert.equal(captainScreenTitle("/captain/triparna-kitchen/take-order"), "New order");
  assert.equal(captainScreenTitle("/captain/triparna-kitchen/orders"), "Orders");
  assert.equal(captainScreenTitle("/captain/triparna-kitchen/bills"), "Bills");
  assert.equal(captainScreenTitle("/captain/triparna-kitchen/tables/table-1"), "Table");
});
