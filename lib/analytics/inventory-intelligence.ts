import { roundQty } from "@/lib/inventory/units";
import type { FiguresSource } from "@/types";

export type IngredientDemandInput = {
  ingredientId: string;
  name: string;
  quantityOnHand: number;
  pendingInboundBase: number;
  predictedDemandBase: number;
  leadTimeDays: number;
  safetyBufferBase?: number;
  demandReliable: boolean;
};

export type IngredientRecommendation = {
  ingredientId: string;
  name: string;
  currentStock: number;
  predictedDemand: number;
  pendingInbound: number;
  suggestedReorder: number;
  daysOfCover: number | null;
  stockoutRisk: boolean;
  figuresSource: FiguresSource;
  reason: string;
};

export function recommendIngredientReorder(input: IngredientDemandInput): IngredientRecommendation {
  if (!input.demandReliable) {
    return {
      ingredientId: input.ingredientId,
      name: input.name,
      currentStock: input.quantityOnHand,
      predictedDemand: input.predictedDemandBase,
      pendingInbound: input.pendingInboundBase,
      suggestedReorder: 0,
      daysOfCover: null,
      stockoutRisk: false,
      figuresSource: "INSUFFICIENT_DATA",
      reason: "Demand estimate is unreliable (insufficient sales or missing recipes).",
    };
  }

  const safety = input.safetyBufferBase ?? roundQty(input.predictedDemandBase * 0.15);
  const available = input.quantityOnHand + input.pendingInboundBase;
  const suggested = Math.max(0, roundQty(input.predictedDemandBase + safety - available));
  const daily = input.predictedDemandBase / 7;
  const daysOfCover = daily > 0 ? roundQty(input.quantityOnHand / daily) : null;
  const stockoutRisk = available + 1e-9 < input.predictedDemandBase;

  return {
    ingredientId: input.ingredientId,
    name: input.name,
    currentStock: input.quantityOnHand,
    predictedDemand: input.predictedDemandBase,
    pendingInbound: input.pendingInboundBase,
    suggestedReorder: suggested,
    daysOfCover,
    stockoutRisk,
    figuresSource: "ESTIMATED",
    reason: stockoutRisk
      ? `Predicted ${input.predictedDemandBase} base units over ~7 days exceeds on-hand (${input.quantityOnHand}) plus inbound (${input.pendingInboundBase}), including safety buffer. Lead time ~${input.leadTimeDays} day(s). Review before creating a PO.`
      : `Cover appears adequate for the predicted window (lead time ~${input.leadTimeDays} day(s)).`,
  };
}
