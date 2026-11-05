import type { Category, Dish, RestaurantBillingSettings } from "@/types";
import { resolveOutletGstRate } from "@/lib/billing/calculate-bill";

/**
 * Priority: dish override → category override → outlet default.
 */
export function resolveLineTaxRate(input: {
  dish?: Pick<Dish, "taxRatePercent"> | null;
  category?: Pick<Category, "taxRatePercent"> | null;
  billing?: RestaurantBillingSettings | null;
}): { rate: number; source: "DISH" | "CATEGORY" | "OUTLET" } {
  if (input.dish?.taxRatePercent != null && Number.isFinite(input.dish.taxRatePercent)) {
    return { rate: Math.max(0, Math.min(100, input.dish.taxRatePercent)), source: "DISH" };
  }
  if (
    input.category?.taxRatePercent != null &&
    Number.isFinite(input.category.taxRatePercent)
  ) {
    return {
      rate: Math.max(0, Math.min(100, input.category.taxRatePercent)),
      source: "CATEGORY",
    };
  }
  return { rate: resolveOutletGstRate(input.billing), source: "OUTLET" };
}
