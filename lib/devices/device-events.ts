import { randomUUID } from "crypto";
import type { DeviceEventRecord, DeviceRecord } from "@/lib/devices/device.types";

export function makeDeviceEvent(
  device: DeviceRecord,
  type: string,
  payload: Record<string, unknown>,
  actorId?: string,
): DeviceEventRecord {
  return {
    id: `devt-${randomUUID()}`,
    restaurantId: device.restaurantId,
    outletId: device.outletId,
    deviceId: device.id,
    type,
    simulated: device.simulated,
    payload: {
      ...payload,
      simulatedLabel: device.simulated ? "SIMULATED" : "PHYSICAL",
    },
    createdAt: new Date().toISOString(),
    actorId,
  };
}
