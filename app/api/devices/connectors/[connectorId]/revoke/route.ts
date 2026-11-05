import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";
import { connectorService, ConnectorServiceError } from "@/lib/services/connector.service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ connectorId: string }> };

export async function POST(_request: Request, { params }: Ctx) {
  const { connectorId } = await params;
  const auth = await requireOutletPermission({
    feature: "HARDWARE_LOCAL_CONNECTOR",
    permission: DEVICES_MANAGE_PERMISSION,
  });
  if (!auth.ok) return auth.response;
  try {
    const data = await connectorService.revoke(connectorId, auth.restaurantId);
    return NextResponse.json({ success: true, data });
  } catch (cause) {
    if (cause instanceof ConnectorServiceError) {
      return NextResponse.json({ success: false, error: cause.message }, { status: cause.statusCode });
    }
    return NextResponse.json({ success: false, error: "Unable to revoke connector." }, { status: 500 });
  }
}
