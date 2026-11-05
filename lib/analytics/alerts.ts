import { roundMoney } from "@/lib/order-pricing";
import type { AiAlertSeverity, FiguresSource } from "@/types";
import type { SalesSummaryMetrics } from "@/lib/analytics/sales";

export type DetectedAlert = {
  type: string;
  dedupeKey: string;
  title: string;
  severity: AiAlertSeverity;
  reason: string;
  suggestedAction: string;
  supportingData: Record<string, unknown>;
  figuresSource: FiguresSource;
};

export function detectSalesDrop(params: {
  restaurantId: string;
  current: SalesSummaryMetrics;
  previous: SalesSummaryMetrics;
  thresholdPct?: number;
}): DetectedAlert | null {
  const threshold = params.thresholdPct ?? 25;
  if (params.previous.grossSales <= 0) return null;
  const dropPct =
    ((params.previous.grossSales - params.current.grossSales) / params.previous.grossSales) * 100;
  if (dropPct < threshold) return null;
  return {
    type: "SALES_DROP",
    dedupeKey: `SALES_DROP:${params.restaurantId}:${params.current.from}:${params.current.to}`,
    title: "Sudden sales drop",
    severity: dropPct >= 40 ? "CRITICAL" : "WARNING",
    reason: `Gross sales fell ${roundMoney(dropPct)}% versus the comparison period.`,
    suggestedAction: "Review cancellations, staffing, and local events; compare dish mix.",
    supportingData: {
      currentGross: params.current.grossSales,
      previousGross: params.previous.grossSales,
      dropPct: roundMoney(dropPct),
    },
    figuresSource: "ACTUAL",
  };
}

export function detectHighCancelRate(params: {
  restaurantId: string;
  summary: SalesSummaryMetrics;
  threshold?: number;
}): DetectedAlert | null {
  const threshold = params.threshold ?? 0.15;
  if (params.summary.orderCount < 5 || params.summary.cancelRate < threshold) return null;
  return {
    type: "HIGH_CANCEL_RATE",
    dedupeKey: `HIGH_CANCEL_RATE:${params.restaurantId}:${params.summary.from}:${params.summary.to}`,
    title: "Elevated cancellation rate",
    severity: params.summary.cancelRate >= 0.3 ? "CRITICAL" : "WARNING",
    reason: `Cancel/reject rate is ${roundMoney(params.summary.cancelRate * 100)}% of orders in period.`,
    suggestedAction: "Inspect kitchen delays and inventory stockouts driving cancellations.",
    supportingData: {
      cancelRate: params.summary.cancelRate,
      cancelledOrRejected: params.summary.cancelledOrRejected,
      orderCount: params.summary.orderCount,
    },
    figuresSource: "ACTUAL",
  };
}

export function detectRefundSpike(params: {
  restaurantId: string;
  currentRefunds: number;
  previousRefunds: number;
  from: string;
  to: string;
}): DetectedAlert | null {
  if (params.previousRefunds <= 0 && params.currentRefunds < 500) return null;
  if (params.currentRefunds <= params.previousRefunds * 2 || params.currentRefunds < 100) return null;
  return {
    type: "REFUND_SPIKE",
    dedupeKey: `REFUND_SPIKE:${params.restaurantId}:${params.from}:${params.to}`,
    title: "Unusual refund activity",
    severity: "WARNING",
    reason: `Refunds rose to ${params.currentRefunds} from ${params.previousRefunds} in the prior window.`,
    suggestedAction: "Audit refund reasons and payment corrections with managers.",
    supportingData: {
      currentRefunds: params.currentRefunds,
      previousRefunds: params.previousRefunds,
    },
    figuresSource: "ACTUAL",
  };
}

export function detectWastageSpike(params: {
  restaurantId: string;
  currentQty: number;
  previousQty: number;
  from: string;
  to: string;
}): DetectedAlert | null {
  if (params.currentQty <= 0) return null;
  if (params.previousQty > 0 && params.currentQty < params.previousQty * 2) return null;
  if (params.previousQty === 0 && params.currentQty < 1) return null;
  return {
    type: "WASTAGE_SPIKE",
    dedupeKey: `WASTAGE_SPIKE:${params.restaurantId}:${params.from}:${params.to}`,
    title: "Abnormal wastage",
    severity: "WARNING",
    reason: `Wastage quantity ${params.currentQty} is elevated versus prior period (${params.previousQty}).`,
    suggestedAction: "Review prep overproduction and expiry handling.",
    supportingData: {
      currentQty: params.currentQty,
      previousQty: params.previousQty,
    },
    figuresSource: "ACTUAL",
  };
}
