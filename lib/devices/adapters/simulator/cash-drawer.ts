import {
  BaseSimulatorAdapter,
  SIM_BANNER,
  simFail,
  simOk,
} from "@/lib/devices/adapters/simulator/base-simulator";
import { getSimulatorRuntime } from "@/lib/devices/adapters/simulator/simulator-state";
import type { DeviceCommand, DeviceCommandResult, DeviceRecord } from "@/lib/devices/device.types";

export class SimulatorCashDrawerAdapter extends BaseSimulatorAdapter {
  async sendCommand(device: DeviceRecord, command: DeviceCommand): Promise<DeviceCommandResult> {
    const rt = getSimulatorRuntime(device.id);
    if (rt.offline) return simFail("Cash drawer offline (simulated)", "OFFLINE");

    if (command.name === "OPEN_DRAWER") {
      const authorized = command.payload?.authorized === true;
      if (!authorized) {
        return simFail("Unauthorized drawer open rejected (simulated)", "UNAUTHORIZED", "REJECTED");
      }
      rt.drawerOpen = true;
      return simOk(`${SIM_BANNER}: drawer opened (virtual only — not physical)`, {
        drawerOpen: true,
        physical: false,
        shiftId: command.payload?.shiftId,
      });
    }
    if (command.name === "CLOSE_DRAWER") {
      rt.drawerOpen = false;
      return simOk(`${SIM_BANNER}: drawer closed (virtual)`, { drawerOpen: false, physical: false });
    }
    if (command.name === "HEALTH_CHECK") return this.healthCheck(device);
    return simFail(`Unsupported command ${command.name}`, "UNSUPPORTED", "REJECTED");
  }
}
