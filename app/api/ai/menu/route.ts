import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { analyticsService } from "@/lib/services/analytics.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const outletId = url.searchParams.get("outletId") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const auth = await requireOutletPermission({
    feature: "AI_MENU_INTELLIGENCE",
    permission: "OUTLET_REPORTS_READ",
    requestedOutletId: outletId ?? undefined,
  });
  if (!auth.ok) return auth.response;
  const data = await analyticsService.menuIntelligence(auth.restaurantId, from, to);
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}
