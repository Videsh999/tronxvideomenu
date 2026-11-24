import { NextResponse } from "next/server";
import { requireOutletPermission, requireAdminRestaurantFeature } from "@/lib/admin-api";
import { analyticsService } from "@/lib/services/analytics.service";
import { forecastService } from "@/lib/services/forecast.service";
import { aiAlertService } from "@/lib/services/ai-alert.service";
import { hasRestaurantFeature } from "@/lib/features";
import type { FeatureKey, Restaurant } from "@/types";

export const dynamic = "force-dynamic";

const AI_FEATURES: FeatureKey[] = [
  "AI_BUSINESS_ASSISTANT",
  "AI_SALES_FORECAST",
  "AI_INVENTORY_INTELLIGENCE",
  "AI_MENU_INTELLIGENCE",
  "AI_OPERATIONAL_ALERTS",
];

async function authorizeAnyAi(outletId?: string) {
  // Prefer a single feature the outlet actually has, so we don't burn 5 auth round-trips.
  const probe = await requireAdminRestaurantFeature(AI_FEATURES[0]);
  if (probe.ok) {
    const restaurant = probe.restaurant;
    const entitled = AI_FEATURES.find((feature) => hasRestaurantFeature(restaurant, feature));
    if (!entitled) {
      return {
        ok: false as const,
        response: NextResponse.json(
          { success: false, error: "No AI Intelligence features are enabled for this outlet." },
          { status: 403 },
        ),
      };
    }
    return requireOutletPermission({
      feature: entitled,
      permission: "OUTLET_REPORTS_READ",
      requestedOutletId: outletId,
    });
  }

  // First feature may be off — walk remaining entitlements.
  let lastFail: NextResponse = probe.response;
  for (const feature of AI_FEATURES.slice(1)) {
    const auth = await requireOutletPermission({
      feature,
      permission: "OUTLET_REPORTS_READ",
      requestedOutletId: outletId,
    });
    if (auth.ok) return auth;
    lastFail = auth.response;
  }
  return { ok: false as const, response: lastFail };
}

async function settle<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await authorizeAnyAi(outletId);
  if (!auth.ok) return auth.response;

  const restaurant = auth.restaurant as Restaurant;
  const to = new Date().toISOString();
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const sales = await settle(analyticsService.salesSummary(auth.restaurantId, start.toISOString(), to));
  if (!sales) {
    return NextResponse.json(
      { success: false, error: "Could not load today’s sales summary." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  const [forecast, inventory, menu, alerts] = await Promise.all([
    hasRestaurantFeature(restaurant, "AI_SALES_FORECAST")
      ? settle(forecastService.getOrCreate(auth.restaurantId, "NEXT_7_DAYS", restaurant.organizationId))
      : Promise.resolve(null),
    hasRestaurantFeature(restaurant, "AI_INVENTORY_INTELLIGENCE")
      ? settle(analyticsService.inventoryRecommendations(auth.restaurantId))
      : Promise.resolve(null),
    hasRestaurantFeature(restaurant, "AI_MENU_INTELLIGENCE")
      ? settle(
          analyticsService.menuIntelligence(
            auth.restaurantId,
            new Date(Date.now() - 7 * 86_400_000).toISOString(),
            to,
          ),
        )
      : Promise.resolve(null),
    hasRestaurantFeature(restaurant, "AI_OPERATIONAL_ALERTS")
      ? settle(aiAlertService.list(auth.restaurantId, "NEW"))
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
        partial:
          (hasRestaurantFeature(restaurant, "AI_SALES_FORECAST") && !forecast) ||
          (hasRestaurantFeature(restaurant, "AI_INVENTORY_INTELLIGENCE") && !inventory) ||
          (hasRestaurantFeature(restaurant, "AI_MENU_INTELLIGENCE") && !menu) ||
          (hasRestaurantFeature(restaurant, "AI_OPERATIONAL_ALERTS") && !alerts),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
