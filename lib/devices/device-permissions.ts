import type { OrgPermission } from "@/lib/org-rbac";
import type { FeatureKey } from "@/types";
import type { DeviceType } from "@/lib/devices/device.types";

/** Org RBAC permission for device registry management. */
export const DEVICES_MANAGE_PERMISSION: OrgPermission = "OUTLET_DEVICES_MANAGE";

export function featureForDeviceType(type: DeviceType): FeatureKey {
  switch (type) {
    case "RECEIPT_PRINTER":
    case "KITCHEN_PRINTER":
      return "HARDWARE_PRINTING";
    case "CASH_DRAWER":
      return "HARDWARE_CASH_DRAWER";
    case "BARCODE_SCANNER":
      return "HARDWARE_BARCODE";
    case "PAYMENT_TERMINAL":
      return "HARDWARE_PAYMENT_TERMINAL";
    case "CUSTOMER_DISPLAY":
      return "HARDWARE_CUSTOMER_DISPLAY";
    default:
      return "HARDWARE_SIMULATOR";
  }
}

export function simulatorFeatureRequired(): FeatureKey {
  return "HARDWARE_SIMULATOR";
}
