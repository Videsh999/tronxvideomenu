import { NextResponse } from "next/server";
import { authorizeDevicesManage } from "@/lib/devices/device-api-auth";
import { authorizedFallbackSchema } from "@/lib/validations";
import { deviceFleetService } from "@/lib/services/device-fleet.service";
import { DeviceServiceError } from "@/lib/services/device.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ jobId: string }> };

/** Explicit authorized fallback reprint — never automatic dual-print. */
export async function POST(request: Request, { params }: Ctx) {
  const { jobId } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = authorizedFallbackSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }
  const auth = await authorizeDevicesManage(parsed.data.outletId);
  if (!auth.ok) return auth.response;
  try {
    const result = await deviceFleetService.enqueueAuthorizedFallback({
      restaurantId: auth.restaurantId,
      originalJobId: jobId,
      fallbackDeviceId: parsed.data.fallbackDeviceId,
      actorId: auth.accountId,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (cause) {
    if (cause instanceof DeviceServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to enqueue fallback." }, { status: 500 });
  }
}
