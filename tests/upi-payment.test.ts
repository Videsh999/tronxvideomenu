import assert from "node:assert/strict";
import test from "node:test";
import { buildUpiPaymentUri, isValidUpiId } from "../lib/upi-payment";

test("buildUpiPaymentUri creates an exact per-order INR payment intent", () => {
  const uri = buildUpiPaymentUri({
    upiId: "9133110805@okbizaxis",
    payeeName: "Triparna Kitchen",
    amount: 228.9,
    orderNumber: 1042,
  });
  const parsed = new URL(uri);
  assert.equal(parsed.protocol, "upi:");
  assert.equal(parsed.hostname, "pay");
  assert.equal(parsed.searchParams.get("pa"), "9133110805@okbizaxis");
  assert.equal(parsed.searchParams.get("pn"), "Triparna Kitchen");
  assert.equal(parsed.searchParams.get("am"), "228.90");
  assert.equal(parsed.searchParams.get("cu"), "INR");
  assert.equal(parsed.searchParams.get("tn"), "Order #1042");
  assert.equal(parsed.searchParams.get("tr"), "TRONX-1042");
});

test("UPI payment intent rejects invalid accounts and amounts", () => {
  assert.equal(isValidUpiId("merchant@bank"), true);
  assert.equal(isValidUpiId("not-an-account"), false);
  assert.throws(() => buildUpiPaymentUri({ upiId: "bad", payeeName: "Test", amount: 10, orderNumber: 1 }));
  assert.throws(() => buildUpiPaymentUri({ upiId: "merchant@bank", payeeName: "Test", amount: 0, orderNumber: 1 }));
});
