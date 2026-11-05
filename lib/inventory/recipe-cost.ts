import { convertToBase, roundQty } from "@/lib/inventory/units";
import type { Ingredient, InventoryUnit, Recipe, RecipeLine } from "@/types";

export type CostedRecipeLine = {
  ingredientId: string;
  quantityBase: number;
  unitCost: number;
  lineCost: number;
};

export type RecipeCostResult = {
  totalCost: number;
  costPerPortion: number;
  lines: CostedRecipeLine[];
  /** Estimated only — not verified accounting profit. */
  estimated: true;
};

export function costRecipeLines(
  lines: RecipeLine[],
  ingredientsById: Map<string, Ingredient>,
  yieldPortions: number,
): RecipeCostResult {
  const portions = Math.max(1, yieldPortions);
  const costed = lines.map((line) => {
    const ingredient = ingredientsById.get(line.ingredientId);
    if (!ingredient) throw new Error(`Ingredient ${line.ingredientId} not found for recipe costing.`);
    const quantityBase = roundQty(
      convertToBase(line.quantity, line.unit, ingredient.baseUnit, ingredient.conversions),
    );
    const unitCost = ingredient.averageUnitCost ?? ingredient.lastPurchaseUnitCost ?? 0;
    const lineCost = roundQty(quantityBase * unitCost);
    return {
      ingredientId: line.ingredientId,
      quantityBase,
      unitCost,
      lineCost,
    };
  });
  const totalCost = roundQty(costed.reduce((sum, line) => sum + line.lineCost, 0));
  return {
    totalCost,
    costPerPortion: roundQty(totalCost / portions),
    lines: costed,
    estimated: true,
  };
}

export function estimateDishMargin(params: {
  sellPrice: number;
  recipeCostPerPortion: number;
}): {
  estimatedGrossMargin: number;
  estimatedGrossMarginPercent: number;
  estimated: true;
  disclaimer: string;
} {
  const margin = params.sellPrice - params.recipeCostPerPortion;
  const percent = params.sellPrice <= 0 ? 0 : (margin / params.sellPrice) * 100;
  return {
    estimatedGrossMargin: roundQty(margin),
    estimatedGrossMarginPercent: roundQty(percent),
    estimated: true,
    disclaimer:
      "Estimated gross margin from configured recipe costs and menu price — not verified accounting profit.",
  };
}

export function scaleRecipeForPortions(
  recipe: Recipe,
  portions: number,
): { ingredientId: string; quantity: number; unit: InventoryUnit }[] {
  const yieldPortions = Math.max(1, recipe.yieldPortions);
  const factor = portions / yieldPortions;
  return recipe.lines.map((line) => ({
    ingredientId: line.ingredientId,
    quantity: line.quantity * factor,
    unit: line.unit,
  }));
}
