import { requireOutletPermission } from "@/lib/admin-api";
import { DEVICES_MANAGE_PERMISSION } from "@/lib/devices/device-permissions";

/** Authorize device admin APIs — accept simulator or printing feature. */
export async function authorizeDevicesManage(outletId?: string) {
  const auth = await requireOutletPermission({
    feature: "HARDWARE_SIMULATOR",
    permission: DEVICES_MANAGE_PERMISSION,
    requestedOutletId: outletId,
  });
  if (auth.ok) return auth;
  const printing = await requireOutletPermission({
    feature: "HARDWARE_PRINTING",
    permission: DEVICES_MANAGE_PERMISSION,
    requestedOutletId: outletId,
  });
  if (printing.ok) return printing;
  return requireOutletPermission({
    feature: "HARDWARE_LOCAL_CONNECTOR",
    permission: DEVICES_MANAGE_PERMISSION,
    requestedOutletId: outletId,
  });
}
