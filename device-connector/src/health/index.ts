import type { CloudDevice } from "../cloud/client.js";
import { validatePrinterConfig } from "../printers/escpos.js";

export function deviceHealthReports(devices: CloudDevice[]) {
  return devices.map((device) => {
    const host = String(device.configuration?.host ?? "");
    const invalid = validatePrinterConfig({
      host,
      port: Number(device.configuration?.port ?? 9100),
    });
    if (invalid) {
      return {
        deviceId: device.id,
        health: "UNKNOWN" as const,
        connectionStatus: "DISCONNECTED" as const,
      };
    }
    return {
      deviceId: device.id,
      health: "HEALTHY" as const,
      connectionStatus: "CONNECTED" as const,
    };
  });
}
