import {
  BaseSimulatorAdapter,
  SIM_BANNER,
  simFail,
  simOk,
} from "@/lib/devices/adapters/simulator/base-simulator";
import { getSimulatorRuntime } from "@/lib/devices/adapters/simulator/simulator-state";
import type {
  DeviceCommand,
  DeviceCommandResult,
  DeviceRecord,
  ReceiptPreview,
} from "@/lib/devices/device.types";

export function buildReceiptPreview(payload: Record<string, unknown>): ReceiptPreview {
  const orderNumber = String(payload.orderNumber ?? "—");
  const items = Array.isArray(payload.items) ? payload.items : [];
  const lines = items.map((item) => {
    const row = item as { name?: string; qty?: number; total?: number };
    return `${row.qty ?? 1}× ${row.name ?? "Item"}  ${row.total ?? 0}`;
  });
  const subtotal = Number(payload.subtotal ?? 0);
  const discount = Number(payload.discount ?? 0);
  const tax = Number(payload.tax ?? 0);
  const total = Number(payload.total ?? 0);
  return {
    title: `Receipt #${orderNumber}`,
    lines: [SIM_BANNER, ...lines, `Subtotal ${subtotal}`, `Discount ${discount}`, `Tax ${tax}`, `TOTAL ${total}`],
    simulatedBanner: SIM_BANNER,
    totals: { subtotal, discount, tax, total },
  };
}

export class SimulatorReceiptPrinterAdapter extends BaseSimulatorAdapter {
  async sendCommand(device: DeviceRecord, command: DeviceCommand): Promise<DeviceCommandResult> {
    const rt = getSimulatorRuntime(device.id);
    if (command.name === "SIMULATE_PAPER_OUT") {
      rt.paperOut = true;
      return simOk("Paper out simulated", { paperOut: true });
    }
    if (command.name === "SIMULATE_OFFLINE") {
      rt.offline = true;
      return simOk("Offline simulated", { offline: true });
    }
    if (command.name === "SIMULATE_RECOVER") {
      rt.paperOut = false;
      rt.offline = false;
      rt.forcePrintFail = false;
      return simOk("Simulator recovered", { health: "HEALTHY" });
    }
    if (command.name === "SIMULATE_PRINT_FAIL") {
      rt.forcePrintFail = true;
      return simOk("Next print will fail (simulated)", { forcePrintFail: true });
    }
    if (command.name === "HEALTH_CHECK") return this.healthCheck(device);
    if (command.name !== "PRINT") {
      return simFail(`Unsupported command ${command.name}`, "UNSUPPORTED", "REJECTED");
    }
    if (rt.offline) return simFail("Printer offline (simulated)", "OFFLINE");
    if (rt.paperOut) return simFail("Paper out (simulated)", "PAPER_OUT");
    if (rt.forcePrintFail) {
      rt.forcePrintFail = false;
      return simFail("Print failed (simulated)", "PRINT_FAIL");
    }
    const preview = buildReceiptPreview(command.payload ?? {});
    return simOk("Receipt printed (simulated)", { preview, jobType: command.payload?.jobType });
  }
}
