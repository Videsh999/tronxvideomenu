"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Dish, Ingredient, InventoryUnit, Recipe } from "@/types";
import { costRecipeLines, estimateDishMargin } from "@/lib/inventory/recipe-cost";

type Props = {
  restaurantName: string;
  dishes: Dish[];
};

type DraftLine = { ingredientId: string; quantity: number; unit: InventoryUnit };

export default function RecipeEditor({ restaurantName, dishes }: Props) {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [dishId, setDishId] = useState(dishes[0]?.id ?? "");
  const [name, setName] = useState("Recipe");
  const [yieldPortions, setYieldPortions] = useState(1);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [ingRes, recipeRes] = await Promise.all([
        fetch("/api/inventory/ingredients"),
        fetch("/api/inventory/recipes"),
      ]);
      const [ingJson, recipeJson] = await Promise.all([ingRes.json(), recipeRes.json()]);
      if (ingJson.success) setIngredients(ingJson.data);
      if (recipeJson.success) setRecipes(recipeJson.data);
    })();
  }, []);

  useEffect(() => {
    const existing = recipes.find((recipe) => recipe.dishId === dishId);
    if (existing) {
      setName(existing.name);
      setYieldPortions(existing.yieldPortions);
      setLines(
        existing.lines.map((line) => ({
          ingredientId: line.ingredientId,
          quantity: line.quantity,
          unit: line.unit,
        })),
      );
    } else {
      setName(`${dishes.find((dish) => dish.id === dishId)?.name ?? "Dish"} recipe`);
      setLines([]);
      setYieldPortions(1);
    }
  }, [dishId, recipes, dishes]);

  const byId = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );

  const cost = useMemo(() => {
    try {
      if (lines.length === 0) return null;
      return costRecipeLines(lines, byId, yieldPortions);
    } catch {
      return null;
    }
  }, [lines, byId, yieldPortions]);

  const dish = dishes.find((entry) => entry.id === dishId);
  const margin =
    cost && dish
      ? estimateDishMargin({ sellPrice: dish.price, recipeCostPerPortion: cost.costPerPortion })
      : null;
  const missingCost = lines.some((line) => {
    const ingredient = byId.get(line.ingredientId);
    return ingredient && ingredient.averageUnitCost == null && ingredient.lastPurchaseUnitCost == null;
  });

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!dishId || lines.length === 0) {
      setMessage("Add at least one ingredient line.");
      return;
    }
    const response = await fetch("/api/inventory/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dishId, name, yieldPortions, lines }),
    });
    const json = await response.json();
    if (!json.success) {
      setMessage(json.error || "Could not save recipe");
      return;
    }
    setMessage(`Saved recipe for ${json.data.name}`);
    setRecipes((prev) => {
      const without = prev.filter((recipe) => recipe.dishId !== dishId);
      return [...without, json.data];
    });
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Recipes</p>
        <h1 className="font-serif text-3xl text-neutral-900">{restaurantName}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Estimated food cost only — not verified accounting profit.
        </p>
      </header>

      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">{message}</p>
      ) : null}
      {missingCost ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Some ingredients are missing purchase costs — margin estimates may be understated.
        </p>
      ) : null}

      <form onSubmit={onSave} className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="text-sm">
            Dish
            <select
              value={dishId}
              onChange={(e) => setDishId(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
            >
              {dishes.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} · {entry.price}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Recipe name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
            />
          </label>
          <label className="text-sm">
            Yield portions
            <input
              type="number"
              min={1}
              value={yieldPortions}
              onChange={(e) => setYieldPortions(Number(e.target.value) || 1)}
              className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
            />
          </label>
        </div>

        <div className="space-y-2">
          {lines.map((line, index) => (
            <div key={index} className="grid gap-2 md:grid-cols-4">
              <select
                value={line.ingredientId}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...line, ingredientId: e.target.value };
                  setLines(next);
                }}
                className="min-h-11 rounded-xl border border-neutral-200 px-3"
              >
                {ingredients.map((ingredient) => (
                  <option key={ingredient.id} value={ingredient.id}>
                    {ingredient.name} ({ingredient.baseUnit})
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0}
                step="any"
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...line, quantity: Number(e.target.value) || 0 };
                  setLines(next);
                }}
                className="min-h-11 rounded-xl border border-neutral-200 px-3"
              />
              <select
                value={line.unit}
                onChange={(e) => {
                  const next = [...lines];
                  next[index] = { ...line, unit: e.target.value as InventoryUnit };
                  setLines(next);
                }}
                className="min-h-11 rounded-xl border border-neutral-200 px-3"
              >
                {["g", "kg", "ml", "l", "pcs", "dozen"].map((unit) => (
                  <option key={unit} value={unit}>
                    {unit}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setLines(lines.filter((_, i) => i !== index))}
                className="min-h-11 rounded-xl bg-neutral-100"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() =>
            setLines([
              ...lines,
              {
                ingredientId: ingredients[0]?.id ?? "",
                quantity: 1,
                unit: ingredients[0]?.baseUnit ?? "g",
              },
            ])
          }
          className="min-h-11 rounded-xl border border-dashed border-neutral-300 px-4"
          disabled={ingredients.length === 0}
        >
          Add ingredient
        </button>

        <div className="rounded-xl bg-neutral-50 p-4 text-sm">
          <p>Recipe cost / portion: {cost ? cost.costPerPortion.toFixed(2) : "—"}</p>
          <p>Estimated gross margin: {margin ? `${margin.estimatedGrossMarginPercent.toFixed(1)}%` : "—"}</p>
          <p className="mt-1 text-neutral-500">{margin?.disclaimer}</p>
        </div>

        <button type="submit" className="min-h-11 rounded-xl bg-neutral-900 px-5 text-white">
          Save recipe
        </button>
      </form>
    </div>
  );
}
