import assert from "node:assert/strict";
import test from "node:test";
import {
  canAutoRestoreFromPriorStatus,
  consumeIdempotencyKey,
  consumptionPointReached,
  restoreIdempotencyKey,
} from "../lib/inventory/consumption";

test("consumption triggers at configured status", () => {
  assert.equal(consumptionPointReached("PENDING"), false);
  assert.equal(consumptionPointReached("PREPARING"), true);
  assert.equal(
    consumptionPointReached("ACCEPTED", { consumptionPoint: "READY" }),
    false,
  );
  assert.equal(
    consumptionPointReached("READY", { consumptionPoint: "READY" }),
    true,
  );
});

test("idempotency keys are stable per order", () => {
  assert.equal(consumeIdempotencyKey("order-1"), "consume:order-1");
  assert.equal(restoreIdempotencyKey("order-1"), "restore:order-1");
});

test("never auto-restore when prep has started", () => {
  const blocked = canAutoRestoreFromPriorStatus({
    priorStatus: "ACCEPTED",
    items: [
      {
        dishId: "d1",
        dishNameSnapshot: "Soup",
        quantity: 1,
        unitPriceSnapshot: 10,
        addons: [],
        itemTotal: 10,
        preparationStatus: "PREPARING",
      },
    ],
  });
  assert.equal(blocked.allowed, false);
});

test("blocks restore after gate status even without prep flags", () => {
  const blocked = canAutoRestoreFromPriorStatus({
    priorStatus: "READY",
    items: [
      {
        dishId: "d1",
        dishNameSnapshot: "Soup",
        quantity: 1,
        unitPriceSnapshot: 10,
        addons: [],
        itemTotal: 10,
        preparationStatus: "QUEUED",
      },
    ],
    settings: { allowRestoreBefore: "READY" },
  });
  assert.equal(blocked.allowed, false);
});

test("allows early cancel restore before prep", () => {
  const allowed = canAutoRestoreFromPriorStatus({
    priorStatus: "ACCEPTED",
    items: [
      {
        dishId: "d1",
        dishNameSnapshot: "Soup",
        quantity: 1,
        unitPriceSnapshot: 10,
        addons: [],
        itemTotal: 10,
        preparationStatus: "QUEUED",
      },
    ],
  });
  assert.equal(allowed.allowed, true);
});
