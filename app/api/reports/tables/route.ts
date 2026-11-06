import { NextResponse } from "next/server";
import { requireAdminRestaurantFeature } from "@/lib/admin-api";
import { reportingService } from "@/lib/services/reporting.service";

/** Table order volume / revenue — no customer PII. */
export async function GET(request: Request) {
  const auth = await requireAdminRestaurantFeature("ORDER_MANAGEMENT");
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const data = await reportingService.tablePerformance(
    auth.restaurantId,
    url.searchParams.get("from") ?? undefined,
    url.searchParams.get("to") ?? undefined,
  );
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}
