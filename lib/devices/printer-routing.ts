import { defaultPrinterRole } from "@/lib/devices/printer-roles";
import type { DeviceRecord, PrintJobType, PrinterRole } from "@/lib/devices/device.types";

export type PrinterRouteResult = {
  primary: DeviceRecord | null;
  fallback: DeviceRecord | null;
  warnings: string[];
};

function isUsable(device: DeviceRecord): boolean {
  return device.enabled && device.connectionStatus !== "DISABLED";
}

function roleOf(device: DeviceRecord): PrinterRole | undefined {
  return device.printerRole ?? defaultPrinterRole(device.deviceType);
}

function preferPhysical(list: DeviceRecord[]): DeviceRecord | undefined {
  return (
    list.find((d) => d.adapterType === "CONNECTOR" && !d.simulated && isUsable(d)) ??
    list.find((d) => isUsable(d) && Boolean(d.configuration?.isDefault)) ??
    list.find((d) => isUsable(d))
  );
}

function offlineWarning(device: DeviceRecord | null | undefined): string | null {
  if (!device) return null;
  if (device.simulated) return null;
  if (device.connectionStatus === "DISCONNECTED" || device.connectionStatus === "ERROR") {
    return `Printer ${device.name} appears offline (${device.connectionStatus}).`;
  }
  if (device.adapterType === "CONNECTOR" && !String(device.configuration?.host ?? "").trim()) {
    return `Printer ${device.name} has no IP/host configured.`;
  }
  if (device.adapterType === "CONNECTOR" && !String(device.configuration?.connectorId ?? "").trim()) {
    return `Printer ${device.name} is not assigned to a connector.`;
  }
  return null;
}

function receiptCandidates(devices: DeviceRecord[]): DeviceRecord[] {
  return devices.filter((d) => {
    if (d.deviceType !== "RECEIPT_PRINTER") return false;
    const role = roleOf(d);
    return role === "RECEIPT" || role === "SECONDARY_RECEIPT" || role === "OTHER" || !role;
  });
}

/** Select primary receipt printer; secondary/fallback never auto-dual-print. */
export function routeReceiptPrinter(devices: DeviceRecord[]): PrinterRouteResult {
  const printers = receiptCandidates(devices);
  const primaryPool = printers.filter((d) => roleOf(d) !== "SECONDARY_RECEIPT");
  const primary =
    preferPhysical(primaryPool.filter((d) => roleOf(d) === "RECEIPT" || Boolean(d.configuration?.isDefault))) ??
    preferPhysical(primaryPool) ??
    null;
  const fallbackCandidates = printers.filter((d) => d.id !== primary?.id && isUsable(d));
  const fallback =
    fallbackCandidates.find((d) => d.configuration?.isFallback === true) ??
    fallbackCandidates.find((d) => roleOf(d) === "SECONDARY_RECEIPT") ??
    null;
  const warnings: string[] = [];
  if (!primary) warnings.push("No receipt printer configured for this outlet.");
  const ow = offlineWarning(primary);
  if (ow) warnings.push(ow);
  return { primary, fallback, warnings };
}

/** Select KOT printer for a kitchen station — one ticket per station, never duplicate. */
export function routeKotPrinter(
  devices: DeviceRecord[],
  station: string,
): PrinterRouteResult {
  const printers = devices.filter((d) => d.deviceType === "KITCHEN_PRINTER");
  const normalized = station.toUpperCase();
  const stationList = printers.filter((d) => {
    const st = (d.kitchenStation ?? "MAIN").toUpperCase();
    const role = roleOf(d);
    if (normalized === "BAR") {
      return st === "BAR" || role === "BAR";
    }
    return st === normalized && role !== "BAR";
  });
  const mainList = printers.filter((d) => (d.kitchenStation ?? "MAIN").toUpperCase() === "MAIN");
  const primary =
    preferPhysical(stationList) ?? preferPhysical(mainList) ?? preferPhysical(printers) ?? null;
  const fallbackCandidates = printers.filter((d) => d.id !== primary?.id && isUsable(d));
  const fallback =
    fallbackCandidates.find((d) => d.configuration?.isFallback === true) ?? null;
  const warnings: string[] = [];
  if (!primary) warnings.push(`No kitchen printer for station ${station}.`);
  else if ((primary.kitchenStation ?? "MAIN").toUpperCase() !== normalized) {
    warnings.push(
      `No dedicated ${station} printer — routing via ${primary.kitchenStation ?? primary.name}.`,
    );
  }
  const ow = offlineWarning(primary);
  if (ow) warnings.push(ow);
  return { primary, fallback, warnings };
}

export function jobTypeForRoute(kind: "receipt" | "kot", isReprint?: boolean): PrintJobType {
  if (kind === "receipt") return isReprint ? "REPRINT_RECEIPT" : "RECEIPT";
  return isReprint ? "REPRINT_KOT" : "KOT";
}
