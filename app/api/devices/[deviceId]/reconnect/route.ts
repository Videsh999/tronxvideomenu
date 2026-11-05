import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";
import { deviceService, DeviceServiceError } from "@/lib/services/device.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ deviceId: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { deviceId } = await params;
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
    try {
      const data = await deviceService.reconnect(alt.restaurantId, deviceId, alt.principal.account?.id);
      return NextResponse.json({ success: true, data });
    } catch (cause) {
      if (cause instanceof DeviceServiceError) {
        return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
      }
      return NextResponse.json({ success: false, error: "Reconnect failed." }, { status: 500 });
    }
  }
  try {
    const data = await deviceService.reconnect(auth.restaurantId, deviceId, auth.principal.account?.id);
    return NextResponse.json({ success: true, data });
  } catch (cause) {
    if (cause instanceof DeviceServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Reconnect failed." }, { status: 500 });
  }
}
