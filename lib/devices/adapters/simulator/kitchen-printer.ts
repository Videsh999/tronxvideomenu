import {
  BaseSimulatorAdapter,
  SIM_BANNER,
  simFail,
  simOk,
} from "@/lib/devices/adapters/simulator/base-simulator";
import { getSimulatorRuntime } from "@/lib/devices/adapters/simulator/simulator-state";
import type { DeviceCommand, DeviceCommandResult, DeviceRecord } from "@/lib/devices/device.types";

export class SimulatorKitchenPrinterAdapter extends BaseSimulatorAdapter {
  async sendCommand(device: DeviceRecord, command: DeviceCommand): Promise<DeviceCommandResult> {
    const rt = getSimulatorRuntime(device.id);
    if (command.name === "SIMULATE_PAPER_OUT") {
      rt.paperOut = true;
      return simOk("Kitchen printer paper out simulated", { paperOut: true });
    }
    if (command.name === "SIMULATE_OFFLINE") {
      rt.offline = true;
      return simOk("Kitchen printer offline simulated", { offline: true });
    }
    if (command.name === "SIMULATE_RECOVER") {
      rt.paperOut = false;
      rt.offline = false;
      rt.forcePrintFail = false;
      return simOk("Kitchen printer recovered", { health: "HEALTHY" });
    }
    if (command.name === "SIMULATE_PRINT_FAIL") {
      rt.forcePrintFail = true;
      return simOk("Next KOT print will fail", { forcePrintFail: true });
    }
    if (command.name === "HEALTH_CHECK") return this.healthCheck(device);
    if (command.name !== "PRINT") {
      return simFail(`Unsupported command ${command.name}`, "UNSUPPORTED", "REJECTED");
    }
    if (rt.offline) return simFail("Kitchen printer offline (simulated)", "OFFLINE");
    if (rt.paperOut) return simFail("Kitchen printer paper out (simulated)", "PAPER_OUT");
    if (rt.forcePrintFail) {
      rt.forcePrintFail = false;
      return simFail("KOT print failed (simulated)", "PRINT_FAIL");
    }
    const station = String(command.payload?.station ?? device.kitchenStation ?? "MAIN");
    const orderNumber = String(command.payload?.orderNumber ?? "—");
    const items = Array.isArray(command.payload?.items) ? command.payload!.items : [];
    return simOk("KOT printed (simulated)", {
      banner: SIM_BANNER,
      station,
      orderNumber,
      itemCount: items.length,
      ticket: {
        header: `${SIM_BANNER} · KOT · ${station} · #${orderNumber}`,
        items,
        jobType: command.payload?.jobType,
        isReprint: Boolean(command.payload?.isReprint),
      },
    });
  }
}
