import assert from "node:assert/strict";
import test from "node:test";
import type { Category, Dish } from "../types/index";
import { buildMeal, defaultSelections, isDrinkCategory, mealPool } from "../lib/meal-builder";

const categories: Category[] = [
  { id: "starters", name: "Starters", sortOrder: 1, isActive: true },
  { id: "mains", name: "Main Course", sortOrder: 2, isActive: true },
  { id: "drinks", name: "Beverages", sortOrder: 3, isActive: true },
];

const dish = (id: string, categoryId: string, extra: Partial<Dish> = {}): Dish => ({
  id, categoryId, name: id, price: 100, sortOrder: 1, isVeg: true, isAvailable: true, ...extra,
});

const dishes = [
  dish("s1", "starters"), dish("s2", "starters", { isVeg: false }), dish("s3", "starters"),
  dish("m1", "mains"), dish("m2", "mains"), dish("m3", "mains", { isAvailable: false }),
  dish("d1", "drinks"), dish("d2", "drinks"),
];

const seeded = (seed: number) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

test("drink categories are detected by name", () => {
  assert.equal(isDrinkCategory({ name: "Beverages" }), true);
  assert.equal(isDrinkCategory({ name: "Signature Craft Drinks" }), true);
  assert.equal(isDrinkCategory({ name: "Main Course" }), false);
});

test("meals never repeat dishes, skip sold-out items and respect the mood", () => {
  const pool = mealPool(dishes, categories, false);
  for (let seed = 1; seed < 40; seed++) {
    const eat = buildMeal({ pool, mood: "eat", size: 3, random: seeded(seed) });
    assert.equal(eat.length, 3);
    assert.equal(new Set(eat.map((item) => item.id)).size, 3);
    assert.ok(eat.every((item) => item.categoryId !== "drinks" && item.id !== "m3"));
    const both = buildMeal({ pool, mood: "both", size: 3, random: seeded(seed) });
    assert.ok(both.some((item) => item.categoryId === "drinks"));
    assert.ok(both.some((item) => item.categoryId !== "drinks"));
  }
});

test("meals spread picks across categories and keep locked dishes in place", () => {
  const pool = mealPool(dishes, categories, false);
  const meal = buildMeal({ pool, mood: "eat", size: 2, random: seeded(7) });
  assert.notEqual(meal[0].categoryId, meal[1].categoryId);

  const locked = [null, dishes[3], null];
  for (let seed = 1; seed < 20; seed++) {
    const respun = buildMeal({ pool, mood: "eat", size: 3, locked, random: seeded(seed) });
    assert.equal(respun[1].id, "m1");
    assert.equal(new Set(respun.map((item) => item.id)).size, 3);
  }
});

test("vegetarian meals only include vegetarian dishes", () => {
  const pool = mealPool(dishes, categories, true);
  const meal = buildMeal({ pool, mood: "eat", size: 4, random: seeded(3) });
  assert.ok(meal.every((item) => item.isVeg));
});

test("default add-on selections satisfy required groups or ask the guest", () => {
  const withSauce = dish("x", "mains", {
    addonGroups: [{ id: "sauce", name: "Sauce", isRequired: true, minSelect: 1, maxSelect: 1, addons: [
      { id: "gone", name: "Gone", price: 0, isAvailable: false },
      { id: "mint", name: "Mint", price: 10 },
    ] }],
  });
  assert.deepEqual(defaultSelections(withSauce), [{ groupId: "sauce", addonIds: ["mint"] }]);
  const impossible = dish("y", "mains", {
    addonGroups: [{ id: "pick", name: "Pick two", isRequired: true, minSelect: 2, maxSelect: 2, addons: [{ id: "a", name: "A", price: 0 }] }],
  });
  assert.equal(defaultSelections(impossible), null);
});
