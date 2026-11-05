import { NextResponse } from "next/server";
import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";
import { deviceService } from "@/lib/services/device.service";

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
    const jobs = await deviceService.listJobs(alt.restaurantId);
    return NextResponse.json({ success: true, data: jobs });
  }
  const jobs = await deviceService.listJobs(auth.restaurantId);
  return NextResponse.json({ success: true, data: jobs });
}
