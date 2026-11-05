import type {
  DeviceAdapter,
  DeviceCommand,
  DeviceCommandResult,
  DeviceRecord,
} from "@/lib/devices/device.types";

/**
 * Cloud-side adapter for devices bound to a local connector.
 * PRINT commands are not executed in the cloud — jobs stay queued for connector pickup.
 */
export class CloudConnectorAdapter implements DeviceAdapter {
  readonly adapterType = "CONNECTOR" as const;

  async connect(device: DeviceRecord): Promise<DeviceCommandResult> {
    return {
      ok: true,
      simulated: false,
      status: "PENDING",
      message: "Awaiting local connector heartbeat",
      data: { connectorId: device.configuration?.connectorId },
    };
  }

  async disconnect(device: DeviceRecord): Promise<DeviceCommandResult> {
    return {
      ok: true,
      simulated: false,
      status: "SUCCESS",
      message: "Marked disconnected pending connector report",
      data: { connectorId: device.configuration?.connectorId },
    };
  }

  async healthCheck(device: DeviceRecord): Promise<DeviceCommandResult> {
    const host = String(device.configuration?.host ?? "");
    if (!host) {
      return {
        ok: false,
        simulated: false,
        status: "FAILED",
        message: "Printer host not configured on connector device",
        errorCode: "NOT_CONFIGURED",
      };
    }
    return {
      ok: true,
      simulated: false,
      status: "PENDING",
      message: "Health reported by local connector",
      data: { host, port: device.configuration?.port ?? 9100 },
    };
  }

  async sendCommand(device: DeviceRecord, command: DeviceCommand): Promise<DeviceCommandResult> {
    if (command.name === "PRINT" || command.name === "OPEN_DRAWER" || command.name === "HEALTH_CHECK") {
      return {
        ok: true,
        simulated: false,
        status: "PENDING",
        message: "Command deferred to local TRONX Device Connector",
        data: {
          connectorId: device.configuration?.connectorId,
          command: command.name,
          physical: true,
        },
      };
    }
    return {
      ok: false,
      simulated: false,
      status: "REJECTED",
      message: `Cloud connector adapter does not execute ${command.name}`,
      errorCode: "DEFER_TO_CONNECTOR",
    };
  }
}
