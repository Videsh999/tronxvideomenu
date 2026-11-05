import assert from "node:assert/strict";
import test from "node:test";
import { costRecipeLines, estimateDishMargin, scaleRecipeForPortions } from "../lib/inventory/recipe-cost";
import type { Ingredient, Recipe } from "../types/index";

const flour: Ingredient = {
  id: "ing-flour",
  restaurantId: "r1",
  name: "Flour",
  baseUnit: "g",
  conversions: { kg: 1000 },
  quantityOnHand: 5000,
  averageUnitCost: 0.05,
  isActive: true,
  createdAt: "",
  updatedAt: "",
};

test("recipe costing uses purchase costs and yield", () => {
  const result = costRecipeLines(
    [{ ingredientId: "ing-flour", quantity: 0.2, unit: "kg" }],
    new Map([["ing-flour", flour]]),
    2,
  );
  assert.equal(result.lines[0].quantityBase, 200);
  assert.equal(result.totalCost, 10);
  assert.equal(result.costPerPortion, 5);
  assert.equal(result.estimated, true);
});

test("margin is clearly estimated", () => {
  const margin = estimateDishMargin({ sellPrice: 20, recipeCostPerPortion: 5 });
  assert.equal(margin.estimatedGrossMargin, 15);
  assert.equal(margin.estimatedGrossMarginPercent, 75);
  assert.equal(margin.estimated, true);
  assert.match(margin.disclaimer, /not verified accounting profit/i);
});

test("scaleRecipeForPortions multiplies lines", () => {
  const recipe: Recipe = {
    id: "rec-1",
    restaurantId: "r1",
    dishId: "dish-1",
    name: "Bread",
    yieldPortions: 2,
    lines: [{ ingredientId: "ing-flour", quantity: 100, unit: "g" }],
    isActive: true,
    createdAt: "",
    updatedAt: "",
  };
  const scaled = scaleRecipeForPortions(recipe, 4);
  assert.equal(scaled[0].quantity, 200);
});
