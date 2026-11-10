import assert from "node:assert/strict";
import test from "node:test";
import { placeCaptainOrderSchema } from "../lib/validations/index";

test("captain order allows walk-in without phone", () => {
  const parsed = placeCaptainOrderSchema.safeParse({
    tableId: "table-4",
    tableNumber: 4,
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    items: [{ dishId: "dish-1", quantity: 2, selections: [] }],
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.sendToKitchen, false);
  assert.equal(parsed.data.customerPhone, undefined);
});

test("captain order rejects missing table", () => {
  const parsed = placeCaptainOrderSchema.safeParse({
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    items: [{ dishId: "dish-1", quantity: 1, selections: [] }],
  });
  assert.equal(parsed.success, false);
});

test("captain order accepts optional guest name and phone", () => {
  const parsed = placeCaptainOrderSchema.safeParse({
    tableId: "table-2",
    tableNumber: 2,
    guestName: "Walk-in guest",
    customerPhone: "9876543210",
    idempotencyKey: "22222222-2222-4222-8222-222222222222",
    items: [
      {
        dishId: "dish-1",
        variantId: "v1",
        quantity: 1,
        note: "Less spicy",
        selections: [{ groupId: "g1", addons: [{ addonId: "a1" }] }],
      },
    ],
  });
  assert.equal(parsed.success, true);
});
