import { z } from "zod";

/** Fixed allowlist of analytics operations the assistant may invoke. */
export const ANALYTICS_TOOL_NAMES = [
  "sales_summary",
  "sales_by_dish",
  "sales_compare_periods",
  "inventory_low_stock",
  "inventory_wastage",
  "procurement_reorder",
  "crm_inactive_customers",
  "menu_margins",
  "outlet_comparison",
  "forecast_summary",
  "inventory_recommendations",
  "menu_intelligence",
  "list_alerts",
] as const;

export type AnalyticsToolName = (typeof ANALYTICS_TOOL_NAMES)[number];

export const analyticsToolCallSchema = z.object({
  tool: z.enum(ANALYTICS_TOOL_NAMES),
  args: z
    .object({
      from: z.string().optional(),
      to: z.string().optional(),
      previousFrom: z.string().optional(),
      previousTo: z.string().optional(),
      inactiveDays: z.number().int().positive().max(365).optional(),
      horizon: z.enum(["TOMORROW", "NEXT_7_DAYS", "NEXT_30_DAYS"]).optional(),
      limit: z.number().int().positive().max(50).optional(),
    })
    .default({}),
});

export type AnalyticsToolCall = z.infer<typeof analyticsToolCallSchema>;

export const TOOL_DESCRIPTIONS: Record<AnalyticsToolName, string> = {
  sales_summary: "Gross/net sales, order counts, cancel rate for a date range",
  sales_by_dish: "Top dishes by quantity and revenue",
  sales_compare_periods: "Compare current period sales to a previous period",
  inventory_low_stock: "Ingredients at or below reorder level",
  inventory_wastage: "Wastage movements summary",
  procurement_reorder: "Reorder suggestions from reorder levels",
  crm_inactive_customers: "Customers with no recent orders",
  menu_margins: "Estimated dish gross margins from recipes",
  outlet_comparison: "Compare outlets in the organization",
  forecast_summary: "Sales forecast for tomorrow / 7 / 30 days",
  inventory_recommendations: "Predicted demand and reorder recommendations",
  menu_intelligence: "Stars/Plowhorses/Puzzles/Dogs classification",
  list_alerts: "Current operational AI alerts",
};
