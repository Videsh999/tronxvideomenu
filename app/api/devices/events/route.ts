import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";
import { deviceService } from "@/lib/services/device.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const deviceId = new URL(request.url).searchParams.get("deviceId") ?? undefined;
  const auth = await requireOutletPermission({
    feature: "HARDWARE_SIMULATOR",
    permission: DEVICES_MANAGE_PERMISSION,
  });
  if (!auth.ok) {
    const alt = await requireOutletPermission({
      feature: "HARDWARE_PRINTING",
      permission: DEVICES_MANAGE_PERMISSION,
    });
    if (!alt.ok) return auth.response;
    const events = await deviceService.listEvents(alt.restaurantId, deviceId);
    return NextResponse.json({ success: true, data: events });
  }
  const events = await deviceService.listEvents(auth.restaurantId, deviceId);
  return NextResponse.json({ success: true, data: events });
}
