import assert from "node:assert/strict";
import test from "node:test";
import { placePosOrderSchema } from "../lib/validations";

test("dine-in without table fails with clear message", () => {
  const parsed = placePosOrderSchema.safeParse({
    channel: "POS_DINE_IN",
    tableNumber: 0,
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    items: [{ dishId: "d1", quantity: 1 }],
  });
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.match(parsed.error.issues[0]?.message ?? "", /table/i);
  }
});

test("takeaway without table is valid", () => {
  const parsed = placePosOrderSchema.safeParse({
    channel: "POS_TAKEAWAY",
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    items: [{ dishId: "d1", quantity: 1 }],
  });
  assert.equal(parsed.success, true);
});
