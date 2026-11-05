import type { DeviceAdapter, DeviceAdapterType, DeviceType } from "@/lib/devices/device.types";

const adapters = new Map<string, DeviceAdapter>();

function key(adapterType: DeviceAdapterType, deviceType: DeviceType): string {
  return `${adapterType}::${deviceType}`;
}

export function registerDeviceAdapter(
  adapterType: DeviceAdapterType,
  deviceType: DeviceType,
  adapter: DeviceAdapter,
): void {
  adapters.set(key(adapterType, deviceType), adapter);
}

export function resolveDeviceAdapter(
  adapterType: DeviceAdapterType,
  deviceType: DeviceType,
): DeviceAdapter | null {
  return adapters.get(key(adapterType, deviceType)) ?? null;
}

export function listRegisteredAdapterKeys(): string[] {
  return [...adapters.keys()];
}
