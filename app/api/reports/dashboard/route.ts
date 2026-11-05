import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import { reportingService } from "@/lib/services/reporting.service";

export async function GET(request: Request) {
  const auth = await requireAdminRestaurantFeature("ANALYTICS");
  if (!auth.ok) {
    // Allow inventory/CRM restaurants to see a limited dashboard via ORDER_MANAGEMENT if analytics off
    const fallback = await requireAdminRestaurantFeature("ORDER_MANAGEMENT");
    if (!fallback.ok) return auth.response;
    const url = new URL(request.url);
    const data = await reportingService.dashboard(
      fallback.restaurantId,
      url.searchParams.get("from") ?? undefined,
      url.searchParams.get("to") ?? undefined,
    );
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  }
  const url = new URL(request.url);
  const data = await reportingService.dashboard(
    auth.restaurantId,
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined,
  );
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}
