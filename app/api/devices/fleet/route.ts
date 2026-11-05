import { NextResponse } from "next/server";
import { authorizeDevicesManage } from "@/lib/devices/device-api-auth";
import { deviceFleetService } from "@/lib/services/device-fleet.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await authorizeDevicesManage(outletId);
  if (!auth.ok) return auth.response;
  const data = await deviceFleetService.fleetInventory(
    auth.restaurantId,
    outletId ?? auth.restaurantId,
  );
  return NextResponse.json({ success: true, data });
}
