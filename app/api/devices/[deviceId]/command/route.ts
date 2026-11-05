import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";
import { deviceCommandSchema } from "@/lib/validations";
import { deviceService, DeviceServiceError } from "@/lib/services/device.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ deviceId: string }> };

export async function POST(request: Request, { params }: Ctx) {
  const { deviceId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = deviceCommandSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  let auth = await requireOutletPermission({
    feature: "HARDWARE_SIMULATOR",
    permission: DEVICES_MANAGE_PERMISSION,
  });
  if (!auth.ok) {
    auth = await requireOutletPermission({
      feature: "HARDWARE_PRINTING",
      permission: DEVICES_MANAGE_PERMISSION,
    });
  }
  if (!auth.ok) return auth.response;

  const payload = {
    ...(parsed.data.payload ?? {}),
    ...(parsed.data.name === "PAYMENT_REQUEST"
      ? { contaminatesLedger: false, settlement: "NONE" }
      : {}),
  };

  try {
    const data = await deviceService.command(
      auth.restaurantId,
      deviceId,
      { ...parsed.data, payload },
      auth.principal.account?.id ?? auth.accountId,
    );
    return NextResponse.json({ success: true, data });
  } catch (cause) {
    if (cause instanceof DeviceServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Device command failed." }, { status: 500 });
  }
}
