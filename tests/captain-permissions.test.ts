import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertCaptainDiscountAllowed,
  captainMayRecordPayment,
  DEFAULT_CAPTAIN_PERMISSIONS,
  resolveCaptainPermissions,
} from "../lib/captain-permissions";

test("resolveCaptainPermissions fills defaults for legacy captains", () => {
  const resolved = resolveCaptainPermissions({ permissions: undefined });
  assert.equal(resolved.applyCoupon, DEFAULT_CAPTAIN_PERMISSIONS.applyCoupon);
  assert.equal(resolved.maxDiscountPercent, 25);
});

test("captainMayRecordPayment respects method flags", () => {
  const locked = resolveCaptainPermissions({
    permissions: {
      recordCashPayment: true,
      recordUpiPayment: false,
      recordCardPayment: false,
    },
  });
  assert.equal(captainMayRecordPayment(locked, "CASH"), true);
  assert.equal(captainMayRecordPayment(locked, "UPI"), false);
  assert.equal(captainMayRecordPayment(locked, "CARD"), false);
});

test("assertCaptainDiscountAllowed blocks when disabled or over limit", () => {
  const perms = resolveCaptainPermissions({
    permissions: { applyDiscount: true, maxDiscountPercent: 10, maxDiscountAmount: 50 },
  });
  assert.doesNotThrow(() => assertCaptainDiscountAllowed(perms, 20, 400));
  assert.throws(() => assertCaptainDiscountAllowed(perms, 60, 400), /limit of 50/);
  assert.throws(() => assertCaptainDiscountAllowed(perms, 45, 400), /10%/);

  const noDiscount = resolveCaptainPermissions({ permissions: { applyDiscount: false } });
  assert.throws(() => assertCaptainDiscountAllowed(noDiscount, 1, 100), /not permitted/);
});
