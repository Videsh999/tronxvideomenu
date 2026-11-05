import assert from "node:assert/strict";
import test from "node:test";
import { updateIngredientSchema, stockAdjustSchema } from "../lib/validations";

test("updateIngredientSchema accepts metadata patches without quantity", () => {
  const parsed = updateIngredientSchema.safeParse({
    name: "Basmati rice",
    sku: "RIC-001",
    reorderLevel: 50,
    averageUnitCost: 62.5,
    expiryDate: "2026-12-01",
  });
  assert.equal(parsed.success, true);
});

test("updateIngredientSchema rejects empty patch", () => {
  const parsed = updateIngredientSchema.safeParse({});
  assert.equal(parsed.success, false);
});

test("updateIngredientSchema allows clearing optional fields with null", () => {
  const parsed = updateIngredientSchema.safeParse({
    sku: null,
    reorderLevel: null,
    expiryDate: null,
  });
  assert.equal(parsed.success, true);
});

test("stock adjustments still require ingredient id and kind", () => {
  const ok = stockAdjustSchema.safeParse({
    ingredientId: "ing-1",
    quantityDelta: -2,
    kind: "WASTAGE",
    note: "Spoilage",
  });
  assert.equal(ok.success, true);

  const recon = stockAdjustSchema.safeParse({
    ingredientId: "ing-1",
    quantityDelta: 0,
    kind: "RECONCILIATION",
    countedQuantity: 12,
  });
  assert.equal(recon.success, true);
});
