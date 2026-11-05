import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCouponDiscount,
  earnPointsForOrder,
  loyaltyEarnKey,
  redeemPointsValue,
} from "../lib/crm/loyalty";

test("loyalty earn is deterministic and keyed per order", () => {
  assert.equal(earnPointsForOrder({ orderTotal: 250.9, pointsPerCurrencyUnit: 1 }), 250);
  assert.equal(loyaltyEarnKey("order-9"), "loyalty-earn:order-9");
});

test("coupon discount respects minimum and percent/fixed", () => {
  assert.deepEqual(
    applyCouponDiscount({
      orderTotal: 200,
      discountType: "PERCENT",
      discountValue: 10,
    }),
    { discount: 20, payable: 180 },
  );
  assert.deepEqual(
    applyCouponDiscount({
      orderTotal: 200,
      discountType: "FIXED",
      discountValue: 50,
    }),
    { discount: 50, payable: 150 },
  );
  assert.throws(() =>
    applyCouponDiscount({
      orderTotal: 40,
      discountType: "FIXED",
      discountValue: 10,
      minOrderTotal: 100,
    }),
  );
});

test("redeemPointsValue converts points using configured rate", () => {
  assert.equal(redeemPointsValue({ points: 100, currencyPerPoint: 0.25 }), 25);
});
