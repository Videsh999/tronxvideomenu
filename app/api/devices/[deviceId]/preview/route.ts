import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";
import { deviceService, DeviceServiceError } from "@/lib/services/device.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ deviceId: string }> };

const bodySchema = z
  .object({
    kind: z.enum(["RECEIPT", "KOT", "TEST_PAGE"]).default("TEST_PAGE"),
    payload: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export async function POST(request: Request, { params }: Ctx) {
  const { deviceId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const auth = await requireOutletPermission({
    feature: "HARDWARE_PRINTING",
    permission: DEVICES_MANAGE_PERMISSION,
  });
  if (!auth.ok) {
    const alt = await requireOutletPermission({
      feature: "HARDWARE_SIMULATOR",
      permission: DEVICES_MANAGE_PERMISSION,
    });
    if (!alt.ok) return auth.response;
  }
  const principal = auth.ok
    ? auth
    : await requireOutletPermission({
        feature: "HARDWARE_SIMULATOR",
        permission: DEVICES_MANAGE_PERMISSION,
      });
  if (!principal.ok) return principal.response;

  try {
    const device = await deviceService.get(principal.restaurantId, deviceId);
    const preview = deviceService.previewPrint(
      device,
      parsed.data.payload ?? { orderNumber: "PREVIEW", items: [{ name: "Sample", qty: 1, total: 10 }], total: 10 },
      parsed.data.kind,
    );
    return NextResponse.json({
      success: true,
      data: {
        previewLines: preview.previewLines,
        unsupported: preview.unsupported,
        byteLength: preview.bytes.length,
        simulated: device.simulated,
      },
    });
  } catch (cause) {
    if (cause instanceof DeviceServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Preview failed." }, { status: 500 });
  }
}
