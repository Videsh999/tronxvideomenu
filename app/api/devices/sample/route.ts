import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";
import { registerSampleDevicesSchema } from "@/lib/validations";
import { deviceService, DeviceServiceError } from "@/lib/services/device.service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = registerSampleDevicesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const outletId = parsed.data.outletId;
  const auth = await requireOutletPermission({
    feature: "HARDWARE_SIMULATOR",
    permission: DEVICES_MANAGE_PERMISSION,
    requestedOutletId: outletId,
  });
  if (!auth.ok) return auth.response;

  try {
    const result = await deviceService.registerSampleDevices({
      restaurantId: auth.restaurantId,
      outletId: outletId ?? auth.restaurantId,
      organizationId: auth.restaurant.organizationId,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (cause) {
    if (cause instanceof DeviceServiceError) {
      return NextResponse.json(
        { success: false, error: cause.message },
        { status: cause.statusCode },
      );
    }
    return NextResponse.json({ success: false, error: "Unable to register sample devices." }, { status: 500 });
  }
}
