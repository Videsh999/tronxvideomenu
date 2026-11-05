import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";
import { connectorService, ConnectorServiceError } from "@/lib/services/connector.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    outletId: z.string().min(1).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation failed", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const auth = await requireOutletPermission({
    feature: "HARDWARE_LOCAL_CONNECTOR",
    permission: DEVICES_MANAGE_PERMISSION,
    requestedOutletId: parsed.data.outletId,
  });
  if (!auth.ok) return auth.response;

  try {
    const data = await connectorService.createPairingCode({
      restaurantId: auth.restaurantId,
      outletId: parsed.data.outletId ?? auth.restaurantId,
      organizationId: auth.restaurant.organizationId,
      createdBy: auth.accountId,
    });
    return NextResponse.json({ success: true, data });
  } catch (cause) {
    if (cause instanceof ConnectorServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to create pairing code." }, { status: 500 });
  }
}
