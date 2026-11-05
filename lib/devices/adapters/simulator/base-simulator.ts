import type {
  DeviceAdapter,
  DeviceCommand,
  DeviceCommandResult,
  DeviceRecord,
} from "@/lib/devices/device.types";
import { getSimulatorRuntime } from "@/lib/devices/adapters/simulator/simulator-state";

const SIM_BANNER = "SIMULATED — not physical hardware";

export function simOk(
  message: string,
  data?: Record<string, unknown>,
  status: DeviceCommandResult["status"] = "SUCCESS",
): DeviceCommandResult {
  return { ok: status === "SUCCESS" || status === "PENDING", simulated: true, status, message, data };
}

export function simFail(
  message: string,
  errorCode: string,
  status: DeviceCommandResult["status"] = "FAILED",
): DeviceCommandResult {
  return { ok: false, simulated: true, status, message, errorCode };
}

export abstract class BaseSimulatorAdapter implements DeviceAdapter {
  readonly adapterType = "SIMULATOR" as const;

  async connect(device: DeviceRecord): Promise<DeviceCommandResult> {
    const rt = getSimulatorRuntime(device.id);
    rt.offline = false;
    return simOk(`${SIM_BANNER}: connected ${device.name}`, { connectionStatus: "CONNECTED" });
  }

  async disconnect(device: DeviceRecord): Promise<DeviceCommandResult> {
    const rt = getSimulatorRuntime(device.id);
    rt.offline = true;
    return simOk(`${SIM_BANNER}: disconnected ${device.name}`, { connectionStatus: "DISCONNECTED" });
  }

  async healthCheck(device: DeviceRecord): Promise<DeviceCommandResult> {
    const rt = getSimulatorRuntime(device.id);
    if (rt.offline) return simFail("Device offline (simulated)", "OFFLINE", "FAILED");
    if (rt.paperOut) {
      return simOk("Degraded: paper out (simulated)", { health: "DEGRADED", paperOut: true });
    }
    return simOk("Healthy (simulated)", { health: "HEALTHY" });
  }

  abstract sendCommand(device: DeviceRecord, command: DeviceCommand): Promise<DeviceCommandResult>;
}

export { SIM_BANNER };
