import assert from "node:assert/strict";
import test from "node:test";
import { serviceTaxAmount } from "../lib/billing/service-tax";

test("service tax accepts decimal percents such as 2.7 and 3.5", () => {
  assert.equal(serviceTaxAmount(100, "PERCENT", "2.7", ""), 2.7);
  assert.equal(serviceTaxAmount(100, "PERCENT", "3.5", ""), 3.5);
  assert.equal(serviceTaxAmount(109, "PERCENT", "2.7", ""), 2.94);
});

test("service tax amount is a typed rupee value and ignores the percent", () => {
  assert.equal(serviceTaxAmount(109, "AMOUNT", "10", "12.5"), 12.5);
  assert.equal(serviceTaxAmount(109, "PERCENT", "", "12.5"), 0);
  assert.equal(serviceTaxAmount(109, "AMOUNT", "10", "-4"), 0);
});

test("service tax percent cannot exceed the food amount", () => {
  assert.equal(serviceTaxAmount(80, "PERCENT", "150", ""), 80);
});
