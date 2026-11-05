import {
  BaseSimulatorAdapter,
  SIM_BANNER,
  simFail,
  simOk,
} from "@/lib/devices/adapters/simulator/base-simulator";
import { getSimulatorRuntime } from "@/lib/devices/adapters/simulator/simulator-state";
import type { DeviceCommand, DeviceCommandResult, DeviceRecord } from "@/lib/devices/device.types";

export class SimulatorBarcodeScannerAdapter extends BaseSimulatorAdapter {
  async sendCommand(device: DeviceRecord, command: DeviceCommand): Promise<DeviceCommandResult> {
    const rt = getSimulatorRuntime(device.id);
    if (command.name === "HEALTH_CHECK") return this.healthCheck(device);
    if (command.name !== "SCAN") {
      return simFail(`Unsupported command ${command.name}`, "UNSUPPORTED", "REJECTED");
    }
    if (rt.offline) return simFail("Scanner offline (simulated)", "OFFLINE");

    const barcode = String(command.payload?.barcode ?? "").trim();
    if (!barcode) return simFail("Invalid barcode (empty)", "INVALID_BARCODE", "REJECTED");
    if (!/^[A-Za-z0-9\-_.]{3,64}$/.test(barcode)) {
      return simFail("Invalid barcode format", "INVALID_BARCODE", "REJECTED");
    }

    rt.lastScan = barcode;
    const lookup = (command.payload?.lookupResult as Record<string, unknown> | undefined) ?? null;
    if (!lookup) {
      return simOk(`${SIM_BANNER}: unknown barcode`, {
        barcode,
        found: false,
        stockChanged: false,
      });
    }
    return simOk(`${SIM_BANNER}: barcode scanned`, {
      barcode,
      found: true,
      lookup,
      stockChanged: false,
      note: "Lookup only — stock is not adjusted by scanner simulation",
    });
  }
}
