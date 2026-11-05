import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { aiAlertService } from "@/lib/services/ai-alert.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await requireOutletPermission({
    feature: "AI_OPERATIONAL_ALERTS",
    permission: "OUTLET_REPORTS_READ",
    requestedOutletId: outletId ?? undefined,
  });
  if (!auth.ok) return auth.response;
  const data = await aiAlertService.list(auth.restaurantId);
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = z
    .object({
      action: z.enum(["SCAN", "ACKNOWLEDGE", "RESOLVE", "DISMISS"]),
      alertId: z.string().optional(),
      outletId: z.string().optional(),
    })
    .safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ success: false, error: "Invalid alert request." }, { status: 400 });
  }

  const auth = await requireOutletPermission({
    feature: "AI_OPERATIONAL_ALERTS",
    permission: "OUTLET_REPORTS_READ",
    requestedOutletId: body.data.outletId,
  });
  if (!auth.ok) return auth.response;

  if (body.data.action === "SCAN") {
    const data = await aiAlertService.scan(auth.restaurantId, auth.restaurant.organizationId);
    return NextResponse.json({ success: true, data });
  }

  if (!body.data.alertId) {
    return NextResponse.json({ success: false, error: "alertId required." }, { status: 400 });
  }
  const status =
    body.data.action === "ACKNOWLEDGE"
      ? "ACKNOWLEDGED"
      : body.data.action === "RESOLVE"
        ? "RESOLVED"
        : "DISMISSED";
  const alert = await aiAlertService.updateStatus(auth.restaurantId, body.data.alertId, status);
  if (!alert) {
    return NextResponse.json({ success: false, error: "Alert not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true, data: alert });
}
