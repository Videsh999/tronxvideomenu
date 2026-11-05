import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";
import { HARDWARE_COMPATIBILITY_REGISTRY } from "@/lib/devices/compatibility-registry";

export const dynamic = "force-dynamic";

export async function GET() {
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
  }
  return NextResponse.json({
    success: true,
    data: {
      profiles: HARDWARE_COMPATIBILITY_REGISTRY,
      note: "PHYSICALLY_VERIFIED is never set without an on-site pilot record.",
    },
  });
}
