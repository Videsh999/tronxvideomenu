import assert from "node:assert/strict";
import test from "node:test";
import {
  canCancelOrder,
  canReprintKot,
  primaryFloorAction,
  stageForStatus,
  statusLabel,
} from "../lib/order-board";

test("floor stages group accepted and preparing as kitchen", () => {
  assert.equal(stageForStatus("PENDING"), "new");
  assert.equal(stageForStatus("ACCEPTED"), "kitchen");
  assert.equal(stageForStatus("PREPARING"), "kitchen");
  assert.equal(stageForStatus("READY"), "ready");
  assert.equal(stageForStatus("SERVED"), "done");
});

test("accept sends new orders straight to kitchen", () => {
  assert.deepEqual(primaryFloorAction("PENDING"), {
    status: "PREPARING",
    label: "Accept & send to kitchen",
  });
  assert.deepEqual(primaryFloorAction("PREPARING"), {
    status: "READY",
    label: "Mark ready",
  });
  assert.deepEqual(primaryFloorAction("READY"), {
    status: "SERVED",
    label: "Mark served",
  });
});

test("cancel and reprint rules", () => {
  assert.equal(canCancelOrder("PENDING"), true);
  assert.equal(canCancelOrder("PREPARING"), false);
  assert.equal(canReprintKot("PREPARING"), true);
  assert.equal(canReprintKot("PENDING"), false);
  assert.equal(statusLabel("PREPARING"), "Cooking");
});
