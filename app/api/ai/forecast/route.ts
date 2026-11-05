import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { forecastService } from "@/lib/services/forecast.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const horizon = z
    .enum(["TOMORROW", "NEXT_7_DAYS", "NEXT_30_DAYS"])
    .catch("NEXT_7_DAYS")
    .parse(url.searchParams.get("horizon") ?? "NEXT_7_DAYS");
  const outletId = url.searchParams.get("outletId") ?? undefined;

  const auth = await requireOutletPermission({
    feature: "AI_SALES_FORECAST",
    permission: "OUTLET_REPORTS_READ",
    requestedOutletId: outletId ?? undefined,
  });
  if (!auth.ok) return auth.response;

  const data = await forecastService.getOrCreate(
    auth.restaurantId,
    horizon,
    auth.restaurant.organizationId,
  );
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}
