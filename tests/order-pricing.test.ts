import assert from "node:assert/strict";
import test from "node:test";
import {
  amountRemaining,
  computeBillTotals,
  lineItemTotal,
  roundMoney,
} from "../lib/order-pricing";

test("lineItemTotal applies quantity, addons, and item discount", () => {
  assert.equal(
    lineItemTotal({
      unitPrice: 100,
      quantity: 2,
      addonTotals: [20, 10],
      itemDiscountAmount: 30,
    }),
    230,
  );
});

test("lineItemTotal rejects discounts above line gross", () => {
  assert.throws(() =>
    lineItemTotal({
      unitPrice: 50,
      quantity: 1,
      addonTotals: [],
      itemDiscountAmount: 51,
    }),
  );
});

test("computeBillTotals applies bill discount then tax", () => {
  const totals = computeBillTotals({
    lineTotals: [200, 100],
    billDiscountAmount: 50,
    taxRatePercent: 5,
  });
  assert.equal(totals.itemsSubtotal, 300);
  assert.equal(totals.billDiscount, 50);
  assert.equal(totals.taxableAmount, 250);
  assert.equal(totals.taxAmount, 12.5);
  assert.equal(totals.total, 262.5);
});

test("amountRemaining and roundMoney", () => {
  assert.equal(amountRemaining(100, 40), 60);
  assert.equal(amountRemaining(100, 120), 0);
  assert.equal(roundMoney(10.005), 10.01);
});
