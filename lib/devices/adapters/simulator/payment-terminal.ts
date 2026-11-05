import {
  BaseSimulatorAdapter,
  SIM_BANNER,
  simFail,
  simOk,
} from "@/lib/devices/adapters/simulator/base-simulator";
import { getSimulatorRuntime } from "@/lib/devices/adapters/simulator/simulator-state";
import type { DeviceCommand, DeviceCommandResult, DeviceRecord } from "@/lib/devices/device.types";

/**
 * Virtual payment terminal.
 * Results are SIMULATED device events only — never bank/card settlement.
 * Callers must NOT write these outcomes into order.payment.ledger as real collections.
 */
export class SimulatorPaymentTerminalAdapter extends BaseSimulatorAdapter {
  async sendCommand(device: DeviceRecord, command: DeviceCommand): Promise<DeviceCommandResult> {
    const rt = getSimulatorRuntime(device.id);
    if (command.name === "HEALTH_CHECK") return this.healthCheck(device);
    if (command.name === "PAYMENT_CANCEL") {
      return simOk(`${SIM_BANNER}: payment cancelled`, {
        settlement: "NONE",
        simulated: true,
        contaminatesLedger: false,
      });
    }
    if (command.name !== "PAYMENT_REQUEST") {
      return simFail(`Unsupported command ${command.name}`, "UNSUPPORTED", "REJECTED");
    }
    if (rt.offline) return simFail("Terminal offline (simulated)", "OFFLINE");

    const callbackId = String(command.payload?.callbackId ?? "");
    if (callbackId && rt.paymentCallbackIds.has(callbackId)) {
      return simFail("Duplicate payment callback ignored (simulated)", "DUPLICATE_CALLBACK", "REJECTED");
    }
    if (callbackId) rt.paymentCallbackIds.add(callbackId);

    const outcome = String(command.payload?.outcome ?? "APPROVED").toUpperCase();
    const amount = Number(command.payload?.amount ?? 0);
    const base = {
      banner: SIM_BANNER,
      amount,
      simulated: true,
      settlement: "NONE" as const,
      contaminatesLedger: false,
      note: "SIMULATED terminal result — do not record as real payment",
    };

    if (outcome === "TIMEOUT") {
      return simFail("Payment timed out (simulated)", "TIMEOUT", "TIMEOUT");
    }
    if (outcome === "DECLINED") {
      return simOk(`${SIM_BANNER}: payment declined`, { ...base, result: "DECLINED" }, "SUCCESS");
    }
    if (outcome === "PENDING") {
      return simOk(`${SIM_BANNER}: payment pending`, { ...base, result: "PENDING" }, "PENDING");
    }
    if (outcome === "CANCELLED") {
      return simOk(`${SIM_BANNER}: payment cancelled`, { ...base, result: "CANCELLED" });
    }
    return simOk(`${SIM_BANNER}: payment approved (virtual)`, { ...base, result: "APPROVED" });
  }
}
