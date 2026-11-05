import { NextResponse } from "next/server";
import { authorizeDevicesManage } from "@/lib/devices/device-api-auth";
import { assignDeviceConnectorSchema } from "@/lib/validations";
import { deviceFleetService } from "@/lib/services/device-fleet.service";
import { DeviceServiceError } from "@/lib/services/device.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ deviceId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { deviceId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = assignDeviceConnectorSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const auth = await authorizeDevicesManage(parsed.data.outletId);
  if (!auth.ok) return auth.response;
  try {
    const device = await deviceFleetService.assignDeviceToConnector({
      restaurantId: auth.restaurantId,
      deviceId,
      connectorId: parsed.data.connectorId,
      actorId: auth.accountId,
    });
    return NextResponse.json({ success: true, data: device });
  } catch (cause) {
    if (cause instanceof DeviceServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to assign device." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { deviceId } = await params;
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await authorizeDevicesManage(outletId);
  if (!auth.ok) return auth.response;
  try {
    const device = await deviceFleetService.unassignDevice({
      restaurantId: auth.restaurantId,
      deviceId,
      actorId: auth.accountId,
    });
    return NextResponse.json({ success: true, data: device });
  } catch (cause) {
    if (cause instanceof DeviceServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to unassign device." }, { status: 500 });
  }
}
