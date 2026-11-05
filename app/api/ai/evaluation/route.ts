import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { aiEvaluationService } from "@/lib/services/ai-evaluation.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await requireOutletPermission({
    feature: "AI_BUSINESS_ASSISTANT",
    permission: "OUTLET_REPORTS_READ",
    requestedOutletId: outletId,
  });
  if (!auth.ok) {
    const alt = await requireOutletPermission({
      feature: "AI_SALES_FORECAST",
      permission: "OUTLET_REPORTS_READ",
      requestedOutletId: outletId,
    });
    if (!alt.ok) return auth.response;
  }

  const snapshot = await aiEvaluationService.runFullSnapshot();
  return NextResponse.json(
    { success: true, data: snapshot },
    { headers: { "Cache-Control": "no-store" } },
  );
}
