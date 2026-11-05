import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { analyticsService } from "@/lib/services/analytics.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await requireOutletPermission({
    feature: "AI_INVENTORY_INTELLIGENCE",
    permission: "OUTLET_INVENTORY_READ",
    requestedOutletId: outletId ?? undefined,
  });
  if (!auth.ok) return auth.response;
  const data = await analyticsService.inventoryRecommendations(auth.restaurantId);
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}
