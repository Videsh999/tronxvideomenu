import assert from "node:assert/strict";
import test from "node:test";
import { canTransition, isTerminalStatus, ORDER_TRANSITIONS } from "../lib/order-transitions";

test("happy path QR/POS kitchen flow is allowed", () => {
  assert.equal(canTransition("PENDING", "ACCEPTED"), true);
  assert.equal(canTransition("PENDING", "PREPARING"), true);
  assert.equal(canTransition("PREPARING", "READY"), true);
  assert.equal(canTransition("READY", "SERVED"), true);
  assert.equal(canTransition("SERVED", "COMPLETED"), true);
  assert.equal(canTransition("PREPARING", "ACCEPTED"), true);
  assert.equal(canTransition("READY", "PREPARING"), true);
  assert.equal(canTransition("SERVED", "READY"), true);
});

test("invalid transitions are rejected", () => {
  assert.equal(canTransition("PENDING", "SERVED"), false);
  assert.equal(canTransition("CANCELLED", "PREPARING"), false);
  assert.equal(canTransition("COMPLETED", "PREPARING"), false);
  assert.equal(canTransition("REFUNDED", "PAID" as never), false);
});

test("rejection refund and terminal states", () => {
  assert.equal(canTransition("PENDING", "REJECTED"), true);
  assert.equal(canTransition("COMPLETED", "REFUNDED"), true);
  assert.equal(isTerminalStatus("CANCELLED"), true);
  assert.equal(isTerminalStatus("REJECTED"), true);
  assert.equal(isTerminalStatus("REFUNDED"), true);
  assert.equal(ORDER_TRANSITIONS.PREPARING.includes("CANCELLED"), true);
});
