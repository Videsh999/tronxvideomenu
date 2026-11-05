import { NextResponse } from "next/server";
import { authorizeDevicesManage } from "@/lib/devices/device-api-auth";
import { updateDeviceSchema } from "@/lib/validations";
import { deviceService, DeviceServiceError } from "@/lib/services/device.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ deviceId: string }> };

async function authorize(outletId?: string) {
  return authorizeDevicesManage(outletId);
}

export async function GET(request: Request, { params }: Ctx) {
  const { deviceId } = await params;
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await authorize(outletId);
  if (!auth.ok) return auth.response;
  try {
    const device = await deviceService.get(auth.restaurantId, deviceId);
    return NextResponse.json({ success: true, data: device });
  } catch (cause) {
    if (cause instanceof DeviceServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to load device." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { deviceId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = updateDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const auth = await authorize(parsed.data.outletId);
  if (!auth.ok) return auth.response;
  try {
    const device = await deviceService.updateDevice(
      auth.restaurantId,
      deviceId,
      parsed.data,
      auth.accountId,
    );
    return NextResponse.json({ success: true, data: device });
  } catch (cause) {
    if (cause instanceof DeviceServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to update device." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  const { deviceId } = await params;
  const outletId = new URL(request.url).searchParams.get("outletId") ?? undefined;
  const auth = await authorize(outletId);
  if (!auth.ok) return auth.response;
  try {
    const result = await deviceService.removeDevice(auth.restaurantId, deviceId);
    return NextResponse.json({ success: true, data: result });
  } catch (cause) {
    if (cause instanceof DeviceServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to remove device." }, { status: 500 });
  }
}
