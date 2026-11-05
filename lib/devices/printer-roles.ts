import type { DeviceType, PrinterRole } from "@/lib/devices/device.types";

const ROLE_DEVICE_COMPATIBILITY: Record<PrinterRole, DeviceType[]> = {
  RECEIPT: ["RECEIPT_PRINTER"],
  SECONDARY_RECEIPT: ["RECEIPT_PRINTER"],
  KITCHEN: ["KITCHEN_PRINTER"],
  BAR: ["KITCHEN_PRINTER"],
  OTHER: ["RECEIPT_PRINTER", "KITCHEN_PRINTER"],
};

export function isPrinterRoleCompatible(role: PrinterRole, deviceType: DeviceType): boolean {
  return ROLE_DEVICE_COMPATIBILITY[role]?.includes(deviceType) ?? false;
}

export function defaultPrinterRole(deviceType: DeviceType): PrinterRole | undefined {
  if (deviceType === "RECEIPT_PRINTER") return "RECEIPT";
  if (deviceType === "KITCHEN_PRINTER") return "KITCHEN";
  return undefined;
}

/** BAR role must target BAR station (or custom station named BAR). */
export function validateRoleStationAssignment(
  role: PrinterRole | undefined,
  kitchenStation: string | undefined,
): string | null {
  if (role === "BAR" && (kitchenStation ?? "MAIN") !== "BAR") {
    return "BAR printer role requires kitchenStation BAR.";
  }
  if (role === "KITCHEN" && kitchenStation === "BAR") {
    return "Use printerRole BAR for BAR station printers.";
  }
  if ((role === "RECEIPT" || role === "SECONDARY_RECEIPT") && kitchenStation) {
    return "Receipt printer roles cannot be assigned a kitchen station.";
  }
  return null;
}

export function assertAssignablePrinterRole(params: {
  deviceType: DeviceType;
  printerRole?: PrinterRole;
  kitchenStation?: string;
}): { ok: true } | { ok: false; error: string } {
  if (!params.printerRole) return { ok: true };
  if (!isPrinterRoleCompatible(params.printerRole, params.deviceType)) {
    return {
      ok: false,
      error: `printerRole ${params.printerRole} is incompatible with deviceType ${params.deviceType}.`,
    };
  }
  const stationErr = validateRoleStationAssignment(params.printerRole, params.kitchenStation);
  if (stationErr) return { ok: false, error: stationErr };
  return { ok: true };
}
