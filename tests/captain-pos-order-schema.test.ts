import assert from "node:assert/strict";
import { test } from "node:test";
import { placeCaptainOrderSchema } from "../lib/validations";

test("placeCaptainOrderSchema accepts coupon and bill discount fields", () => {
  const parsed = placeCaptainOrderSchema.parse({
    tableNumber: 1,
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    couponCode: "WELCOME10",
    billDiscountAmount: 25,
    sendToKitchen: true,
    items: [{ dishId: "dish-1", quantity: 1, selections: [] }],
  });
  assert.equal(parsed.couponCode, "WELCOME10");
  assert.equal(parsed.billDiscountAmount, 25);
  assert.equal(parsed.sendToKitchen, true);
});

test("placeCaptainOrderSchema still requires a table", () => {
  assert.throws(() =>
    placeCaptainOrderSchema.parse({
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      items: [{ dishId: "dish-1", quantity: 1, selections: [] }],
    }),
  );
});
