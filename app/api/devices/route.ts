import { NextResponse } from "next/server";
import { authorizeDevicesManage } from "@/lib/devices/device-api-auth";
import { registerPrinterSchema } from "@/lib/validations";
import { deviceFleetService } from "@/lib/services/device-fleet.service";
import { deviceService, DeviceServiceError } from "@/lib/services/device.service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await authorizeDevicesManage(outletId);
  if (!auth.ok) return auth.response;
  const devices = await deviceService.list(auth.restaurantId, outletId ?? auth.restaurantId);
  return NextResponse.json({ success: true, data: devices });
}

/** Register an additional printer in the outlet fleet (Phase 6.3). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = registerPrinterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const auth = await authorizeDevicesManage(parsed.data.outletId);
  if (!auth.ok) return auth.response;
  try {
    const device = await deviceFleetService.registerPrinter({
      restaurantId: auth.restaurantId,
      outletId: parsed.data.outletId ?? auth.restaurantId,
      organizationId: auth.restaurant.organizationId,
      name: parsed.data.name,
      deviceType: parsed.data.deviceType,
      printerRole: parsed.data.printerRole,
      kitchenStation: parsed.data.kitchenStation,
      manufacturer: parsed.data.manufacturer,
      model: parsed.data.model,
      configuration: parsed.data.configuration,
      connectorId: parsed.data.connectorId,
      actorId: auth.accountId,
    });
    return NextResponse.json({ success: true, data: device }, { status: 201 });
  } catch (cause) {
    if (cause instanceof DeviceServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to register printer." }, { status: 500 });
  }
}
