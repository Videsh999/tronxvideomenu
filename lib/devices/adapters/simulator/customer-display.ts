import {
  BaseSimulatorAdapter,
  SIM_BANNER,
  simFail,
  simOk,
} from "@/lib/devices/adapters/simulator/base-simulator";
import { getSimulatorRuntime } from "@/lib/devices/adapters/simulator/simulator-state";
import type { DeviceCommand, DeviceCommandResult, DeviceRecord } from "@/lib/devices/device.types";

export class SimulatorCustomerDisplayAdapter extends BaseSimulatorAdapter {
  async sendCommand(device: DeviceRecord, command: DeviceCommand): Promise<DeviceCommandResult> {
    const rt = getSimulatorRuntime(device.id);
    if (command.name === "HEALTH_CHECK") return this.healthCheck(device);
    if (command.name !== "DISPLAY_UPDATE") {
      return simFail(`Unsupported command ${command.name}`, "UNSUPPORTED", "REJECTED");
    }
    if (rt.offline) return simFail("Customer display offline (simulated)", "OFFLINE");

    const items = Array.isArray(command.payload?.items) ? command.payload!.items : [];
    const subtotal = Number(command.payload?.subtotal ?? 0);
    const discount = Number(command.payload?.discount ?? 0);
    const tax = Number(command.payload?.tax ?? 0);
    const total = Number(command.payload?.total ?? 0);
    const paymentStatus = String(command.payload?.paymentStatus ?? "UNPAID");
    rt.displayLines = [
      SIM_BANNER,
      ...items.map((item) => {
        const row = item as { name?: string; qty?: number };
        return `${row.qty ?? 1}× ${row.name ?? "Item"}`;
      }),
      `Subtotal ${subtotal}`,
      `Discount ${discount}`,
      `Tax ${tax}`,
      `Total ${total}`,
      `Payment ${paymentStatus}`,
    ];
    return simOk(`${SIM_BANNER}: display updated`, {
      lines: rt.displayLines,
      totals: { subtotal, discount, tax, total },
      paymentStatus,
    });
  }
}
