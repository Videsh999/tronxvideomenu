import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { aiEvaluationService } from "@/lib/services/ai-evaluation.service";
import { roleHasPermission } from "@/lib/org-rbac";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await requireOutletPermission({
    feature: "AI_BUSINESS_ASSISTANT",
    permission: "OUTLET_REPORTS_READ",
    requestedOutletId: outletId,
  });
  if (!auth.ok) return auth.response;

  const orgWide =
    auth.principal.account?.orgRole &&
    roleHasPermission(auth.principal.account.orgRole, "ORG_VIEW_REPORTS");

  const data = await aiEvaluationService.usageSummary(
    auth.restaurantId,
    orgWide ? auth.restaurant.organizationId : undefined,
  );
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}
