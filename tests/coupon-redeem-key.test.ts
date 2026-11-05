import assert from "node:assert/strict";
import test from "node:test";
import { couponRedeemKey } from "../lib/crm/loyalty";

test("coupon redeem keys are stable per order+code", () => {
  assert.equal(couponRedeemKey("order-1", "save10"), "coupon-redeem:order-1:SAVE10");
  assert.equal(couponRedeemKey("order-1", " SAVE10 "), "coupon-redeem:order-1:SAVE10");
  assert.notEqual(couponRedeemKey("order-1", "SAVE10"), couponRedeemKey("order-2", "SAVE10"));
});
