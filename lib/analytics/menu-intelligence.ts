import { roundMoney } from "@/lib/order-pricing";
import type { DishSalesRow } from "@/lib/analytics/sales";
import type { FiguresSource, MenuDishClass } from "@/types";

export type MenuDishInsight = {
  dishId: string;
  dishName: string;
  quantitySold: number;
  revenue: number;
  popularityShare: number;
  estimatedCostPerPortion: number | null;
  estimatedGrossMargin: number | null;
  estimatedGrossMarginPercent: number | null;
  classification: MenuDishClass;
  figuresSource: FiguresSource;
  explanation: string;
};

export function classifyMenuDishes(params: {
  dishSales: DishSalesRow[];
  costsByDishId: Map<string, { costPerPortion: number | null; sellPrice: number }>;
  popularityThreshold?: number;
  marginPercentThreshold?: number;
}): MenuDishInsight[] {
  const popThreshold = params.popularityThreshold ?? 0.05;
  const marginThreshold = params.marginPercentThreshold ?? 30;
  const totalQty = params.dishSales.reduce((sum, row) => sum + row.quantitySold, 0);

  return params.dishSales.map((row) => {
    const costMeta = params.costsByDishId.get(row.dishId);
    const popularityShare = totalQty > 0 ? row.quantitySold / totalQty : 0;
    const cost = costMeta?.costPerPortion ?? null;
    const sell = costMeta?.sellPrice ?? (row.quantitySold > 0 ? row.revenue / row.quantitySold : 0);
    let estimatedGrossMargin: number | null = null;
    let estimatedGrossMarginPercent: number | null = null;
    let classification: MenuDishClass = "UNCLASSIFIED";
    let figuresSource: FiguresSource = "ACTUAL";
    let explanation = "Missing recipe cost — cannot estimate profitability.";

    if (cost != null && sell > 0) {
      estimatedGrossMargin = roundMoney(sell - cost);
      estimatedGrossMarginPercent = roundMoney((estimatedGrossMargin / sell) * 100);
      figuresSource = "ESTIMATED";
      const popular = popularityShare >= popThreshold;
      const profitable = estimatedGrossMarginPercent >= marginThreshold;
      if (popular && profitable) {
        classification = "STAR";
        explanation = "High popularity and high estimated gross margin.";
      } else if (popular && !profitable) {
        classification = "PLOWHORSE";
        explanation = "High popularity with lower estimated gross margin.";
      } else if (!popular && profitable) {
        classification = "PUZZLE";
        explanation = "Lower popularity with high estimated gross margin.";
      } else {
        classification = "DOG";
        explanation = "Lower popularity and lower estimated gross margin.";
      }
      explanation += " Estimated gross margin is not accounting profit.";
    } else if (row.quantitySold === 0) {
      explanation = "No sales in period.";
      figuresSource = "INSUFFICIENT_DATA";
    }

    return {
      dishId: row.dishId,
      dishName: row.dishName,
      quantitySold: row.quantitySold,
      revenue: row.revenue,
      popularityShare: roundMoney(popularityShare),
      estimatedCostPerPortion: cost,
      estimatedGrossMargin,
      estimatedGrossMarginPercent,
      classification,
      figuresSource,
      explanation,
    };
  });
}
