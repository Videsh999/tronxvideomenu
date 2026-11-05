import assert from "node:assert/strict";
import test from "node:test";
import {
  lineRestoreIdempotencyKey,
  quantitiesToRestoreForLines,
} from "../lib/inventory/line-restore";

test("per-line restore never includes unrelated lines", () => {
  const planned = quantitiesToRestoreForLines({
    consumptionLines: [
      {
        ingredientId: "flour",
        quantityBase: 100,
        movementId: "m1",
        orderLineId: "line-a",
        restoredQuantityBase: 0,
      },
      {
        ingredientId: "oil",
        quantityBase: 20,
        movementId: "m2",
        orderLineId: "line-b",
        restoredQuantityBase: 0,
      },
    ],
    cancelledOrderLineIds: ["line-a"],
    orderItems: [
      {
        lineId: "line-a",
        dishId: "d1",
        dishNameSnapshot: "A",
        quantity: 1,
        unitPriceSnapshot: 10,
        addons: [],
        itemTotal: 10,
        preparationStatus: "QUEUED",
      },
      {
        lineId: "line-b",
        dishId: "d2",
        dishNameSnapshot: "B",
        quantity: 1,
        unitPriceSnapshot: 10,
        addons: [],
        itemTotal: 10,
        preparationStatus: "QUEUED",
      },
    ],
  });
  assert.equal(planned.length, 1);
  assert.equal(planned[0].orderLineId, "line-a");
  assert.equal(planned[0].ingredientId, "flour");
});

test("prepared lines are not restored", () => {
  const planned = quantitiesToRestoreForLines({
    consumptionLines: [
      {
        ingredientId: "flour",
        quantityBase: 100,
        movementId: "m1",
        orderLineId: "line-a",
        restoredQuantityBase: 0,
      },
    ],
    cancelledOrderLineIds: ["line-a"],
    orderItems: [
      {
        lineId: "line-a",
        dishId: "d1",
        dishNameSnapshot: "A",
        quantity: 1,
        unitPriceSnapshot: 10,
        addons: [],
        itemTotal: 10,
        preparationStatus: "READY",
      },
    ],
  });
  assert.equal(planned.length, 0);
});

test("line restore keys are stable and distinct", () => {
  assert.equal(
    lineRestoreIdempotencyKey("order-1", "line-a"),
    "restore-line:order-1:line-a",
  );
  assert.notEqual(
    lineRestoreIdempotencyKey("order-1", "line-a"),
    lineRestoreIdempotencyKey("order-1", "line-b"),
  );
});
