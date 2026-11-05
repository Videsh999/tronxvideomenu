import assert from "node:assert/strict";
import test from "node:test";
import { convertToBase, roundQty } from "../lib/inventory/units";

test("converts kg and g into base grams", () => {
  assert.equal(convertToBase(2, "kg", "g"), 2000);
  assert.equal(convertToBase(500, "g", "g"), 500);
});

test("supports custom conversion map", () => {
  assert.equal(convertToBase(1, "dozen", "pcs", { dozen: 12 }), 12);
});

test("rejects unknown conversions", () => {
  assert.throws(() => convertToBase(1, "l", "g"));
});

test("roundQty keeps micro precision stable", () => {
  assert.equal(roundQty(1.0000004), 1);
});
