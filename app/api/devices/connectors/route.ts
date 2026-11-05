import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";
import { connectorService } from "@/lib/services/connector.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOutletPermission({
    feature: "HARDWARE_LOCAL_CONNECTOR",
    permission: DEVICES_MANAGE_PERMISSION,
  });
  if (!auth.ok) {
    const alt = await requireOutletPermission({
      feature: "HARDWARE_PRINTING",
      permission: DEVICES_MANAGE_PERMISSION,
    });
    if (!alt.ok) return auth.response;
    const data = await connectorService.listForRestaurant(alt.restaurantId);
    return NextResponse.json({ success: true, data });
  }
  const data = await connectorService.listForRestaurant(auth.restaurantId);
  return NextResponse.json({ success: true, data });
}
