import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { analyticsService } from "@/lib/services/analytics.service";
import { forecastService } from "@/lib/services/forecast.service";
import { aiAlertService } from "@/lib/services/ai-alert.service";
import { hasRestaurantFeature } from "@/lib/features";
import type { FeatureKey, Restaurant } from "@/types";

export const dynamic = "force-dynamic";

async function authorizeAnyAi(outletId?: string) {
  const features: FeatureKey[] = [
    "AI_BUSINESS_ASSISTANT",
    "AI_SALES_FORECAST",
    "AI_INVENTORY_INTELLIGENCE",
    "AI_MENU_INTELLIGENCE",
    "AI_OPERATIONAL_ALERTS",
  ];
  let lastFail: NextResponse | null = null;
  for (const feature of features) {
    const auth = await requireOutletPermission({
      feature,
      permission: "OUTLET_REPORTS_READ",
      requestedOutletId: outletId,
    });
    if (auth.ok) return auth;
    lastFail = auth.response;
  }
  return { ok: false as const, response: lastFail! };
}

export async function GET(request: Request) {
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await authorizeAnyAi(outletId);
  if (!auth.ok) return auth.response;

  const restaurant = auth.restaurant as Restaurant;
  const to = new Date().toISOString();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const sales = await analyticsService.salesSummary(auth.restaurantId, start.toISOString(), to);

  const [forecast, inventory, menu, alerts] = await Promise.all([
    hasRestaurantFeature(restaurant, "AI_SALES_FORECAST")
      ? forecastService.getOrCreate(auth.restaurantId, "NEXT_7_DAYS", restaurant.organizationId)
      : Promise.resolve(null),
    hasRestaurantFeature(restaurant, "AI_INVENTORY_INTELLIGENCE")
      ? analyticsService.inventoryRecommendations(auth.restaurantId)
      : Promise.resolve(null),
    hasRestaurantFeature(restaurant, "AI_MENU_INTELLIGENCE")
      ? analyticsService.menuIntelligence(
          auth.restaurantId,
          new Date(Date.now() - 7 * 86_400_000).toISOString(),
          to,
        )
      : Promise.resolve(null),
    hasRestaurantFeature(restaurant, "AI_OPERATIONAL_ALERTS")
      ? aiAlertService.list(auth.restaurantId, "NEW")
      : Promise.resolve(null),
  ]);

  return NextResponse.json(
    {
      success: true,
      data: {
        sales,
        forecast,
        stockRisks: inventory?.recommendations?.filter((row) => row.stockoutRisk).slice(0, 5) ?? [],
        menuHighlights: menu?.dishes?.filter((d) => d.classification === "STAR").slice(0, 5) ?? [],
        alerts: alerts?.alerts?.slice(0, 5) ?? [],
        outletId: auth.restaurantId,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
