import type { DeviceCommandResult, DeviceHealthStatus, DeviceRecord } from "@/lib/devices/device.types";

export function deriveHealthFromResult(
  device: DeviceRecord,
  result: DeviceCommandResult,
): DeviceHealthStatus {
  if (!device.enabled) return "UNKNOWN";
  if (!result.ok) {
    if (result.errorCode === "OFFLINE" || result.status === "TIMEOUT") return "UNHEALTHY";
    if (result.errorCode === "PAPER_OUT") return "DEGRADED";
    return "UNHEALTHY";
  }
  if (result.data?.health === "DEGRADED" || result.data?.paperOut) return "DEGRADED";
  return "HEALTHY";
}

export function connectionFromRuntime(
  offline: boolean,
  enabled: boolean,
): DeviceRecord["connectionStatus"] {
  if (!enabled) return "DISABLED";
  return offline ? "DISCONNECTED" : "CONNECTED";
}
