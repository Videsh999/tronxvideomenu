import { CloudConnectorAdapter } from "@/lib/devices/adapters/connector/cloud-connector-adapter";
import { ensureSimulatorAdaptersRegistered } from "@/lib/devices/adapters/simulator";
import { registerDeviceAdapter, resolveDeviceAdapter } from "@/lib/devices/device-registry";
import type {
  DeviceCommand,
  DeviceCommandResult,
  DeviceRecord,
  DeviceType,
} from "@/lib/devices/device.types";

ensureSimulatorAdaptersRegistered();

const CONNECTOR_DEVICE_TYPES: DeviceType[] = [
  "RECEIPT_PRINTER",
  "KITCHEN_PRINTER",
  "CASH_DRAWER",
  "BARCODE_SCANNER",
  "CUSTOMER_DISPLAY",
  "PAYMENT_TERMINAL",
];

let connectorRegistered = false;
export function ensureConnectorAdaptersRegistered(): void {
  if (connectorRegistered) return;
  const adapter = new CloudConnectorAdapter();
  for (const type of CONNECTOR_DEVICE_TYPES) {
    registerDeviceAdapter("CONNECTOR", type, adapter);
  }
  connectorRegistered = true;
}
ensureConnectorAdaptersRegistered();

export class DeviceManagerError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode = 400,
  ) {
    super(message);
  }
}

export async function runDeviceCommand(
  device: DeviceRecord,
  command: DeviceCommand,
): Promise<DeviceCommandResult> {
  if (!device.enabled) {
    throw new DeviceManagerError("Device is disabled.", "DISABLED", 403);
  }
  const adapter = resolveDeviceAdapter(device.adapterType, device.deviceType);
  if (!adapter) {
    throw new DeviceManagerError(
      `No adapter registered for ${device.adapterType}/${device.deviceType}.`,
      "NO_ADAPTER",
      501,
    );
  }
  const timeoutMs = command.timeoutMs ?? 8_000;
  const result = await Promise.race([
    adapter.sendCommand(device, command),
    new Promise<DeviceCommandResult>((resolve) =>
      setTimeout(
        () =>
          resolve({
            ok: false,
            simulated: device.simulated,
            status: "TIMEOUT",
            message: "Device command timed out",
            errorCode: "TIMEOUT",
          }),
        timeoutMs,
      ),
    ),
  ]);
  return result;
}

export async function connectDevice(device: DeviceRecord): Promise<DeviceCommandResult> {
  const adapter = resolveDeviceAdapter(device.adapterType, device.deviceType);
  if (!adapter) throw new DeviceManagerError("No adapter", "NO_ADAPTER", 501);
  return adapter.connect(device);
}

export async function disconnectDevice(device: DeviceRecord): Promise<DeviceCommandResult> {
  const adapter = resolveDeviceAdapter(device.adapterType, device.deviceType);
  if (!adapter) throw new DeviceManagerError("No adapter", "NO_ADAPTER", 501);
  return adapter.disconnect(device);
}

export async function healthCheckDevice(device: DeviceRecord): Promise<DeviceCommandResult> {
  const adapter = resolveDeviceAdapter(device.adapterType, device.deviceType);
  if (!adapter) throw new DeviceManagerError("No adapter", "NO_ADAPTER", 501);
  return adapter.healthCheck(device);
}
