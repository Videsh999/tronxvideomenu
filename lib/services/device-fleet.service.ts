import { randomUUID } from "crypto";
import { makeDeviceEvent } from "@/lib/devices/device-events";
import {
  assertAssignablePrinterRole,
  defaultPrinterRole,
} from "@/lib/devices/printer-roles";
import type {
  DeviceRecord,
  DeviceType,
  PrinterRole,
} from "@/lib/devices/device.types";
import { CONNECTOR_OFFLINE_AFTER_MS } from "@/lib/devices/connector-crypto";
import { connectorRepository } from "@/lib/repositories/connector.repository";
import { deviceRepository } from "@/lib/repositories/device.repository";
import { DeviceServiceError, deviceService } from "@/lib/services/device.service";

export class DeviceFleetService {
  async registerPrinter(params: {
    restaurantId: string;
    outletId: string;
    organizationId?: string;
    name: string;
    deviceType: Extract<DeviceType, "RECEIPT_PRINTER" | "KITCHEN_PRINTER">;
    printerRole?: PrinterRole;
    kitchenStation?: string;
    manufacturer?: string;
    model?: string;
    configuration?: Record<string, unknown>;
    connectorId?: string;
    actorId?: string;
  }): Promise<DeviceRecord> {
    const printerRole = params.printerRole ?? defaultPrinterRole(params.deviceType);
    const check = assertAssignablePrinterRole({
      deviceType: params.deviceType,
      printerRole,
      kitchenStation: params.kitchenStation,
    });
    if (!check.ok) throw new DeviceServiceError(check.error, 400, "INVALID_ROLE");

    if (params.connectorId) {
      const connector = await connectorRepository.findConnector(params.connectorId);
      if (!connector || connector.restaurantId !== params.restaurantId) {
        throw new DeviceServiceError("Connector not found.", 404);
      }
      if (connector.status === "REVOKED") {
        throw new DeviceServiceError("Cannot assign devices to a revoked connector.", 409);
      }
      if (connector.outletId !== params.outletId) {
        throw new DeviceServiceError("Connector outlet mismatch.", 403, "OUTLET_MISMATCH");
      }
    }

    const now = new Date().toISOString();
    const device: DeviceRecord = {
      id: `dev-${randomUUID()}`,
      organizationId: params.organizationId,
      restaurantId: params.restaurantId,
      outletId: params.outletId,
      name: params.name,
      deviceType: params.deviceType,
      manufacturer: params.manufacturer ?? "Generic",
      model: params.model ?? "ESC/POS Network",
      connectionType: params.connectorId ? "NETWORK" : "SIMULATOR",
      adapterType: params.connectorId ? "CONNECTOR" : "SIMULATOR",
      connectionStatus: "DISCONNECTED",
      healthStatus: "UNKNOWN",
      lastSeenAt: now,
      capabilities: ["PRINT"],
      configuration: {
        ...(params.configuration ?? {}),
        ...(params.connectorId ? { connectorId: params.connectorId } : {}),
        host: params.configuration?.host ?? "",
        port: params.configuration?.port ?? 9100,
        paperWidth: params.configuration?.paperWidth ?? 80,
      },
      simulated: !params.connectorId,
      enabled: true,
      kitchenStation: params.kitchenStation,
      printerRole,
      createdAt: now,
      updatedAt: now,
    };

    const [created] = await deviceRepository.insertDevices([device]);
    await deviceRepository.insertEvent(
      makeDeviceEvent(device, "DEVICE_REGISTERED", { printerRole, connectorId: params.connectorId }, params.actorId),
    );
    return created!;
  }

  async assignDeviceToConnector(params: {
    restaurantId: string;
    deviceId: string;
    connectorId: string;
    actorId?: string;
  }) {
    const device = await deviceService.get(params.restaurantId, params.deviceId);
    const connector = await connectorRepository.findConnector(params.connectorId);
    if (!connector || connector.restaurantId !== params.restaurantId) {
      throw new DeviceServiceError("Connector not found.", 404);
    }
    if (connector.status === "REVOKED") {
      throw new DeviceServiceError("Connector is revoked.", 409);
    }
    if (connector.outletId !== device.outletId) {
      throw new DeviceServiceError(
        "Device and connector must belong to the same outlet.",
        403,
        "OUTLET_MISMATCH",
      );
    }

    const updated = await deviceRepository.updateDevice(params.restaurantId, params.deviceId, {
      adapterType: "CONNECTOR",
      connectionType: "NETWORK",
      simulated: false,
      configuration: {
        ...device.configuration,
        connectorId: params.connectorId,
      },
    });
    await deviceRepository.insertEvent(
      makeDeviceEvent(
        device,
        "DEVICE_ASSIGNED_CONNECTOR",
        { connectorId: params.connectorId, previous: device.configuration?.connectorId },
        params.actorId,
      ),
    );
    return updated;
  }

  async unassignDevice(params: { restaurantId: string; deviceId: string; actorId?: string }) {
    const device = await deviceService.get(params.restaurantId, params.deviceId);
    const previous = device.configuration?.connectorId;
    const { connectorId: _removed, ...rest } = device.configuration ?? {};
    void _removed;
    const updated = await deviceRepository.updateDevice(params.restaurantId, params.deviceId, {
      configuration: { ...rest },
      connectionStatus: "DISCONNECTED",
    });
    await deviceRepository.insertEvent(
      makeDeviceEvent(device, "DEVICE_UNASSIGNED_CONNECTOR", { previous }, params.actorId),
    );
    return updated;
  }

  /**
   * Authorized fallback enqueue — never automatic dual-print.
   * Creates a distinct reprint-style job targeted at the fallback device.
   */
  async enqueueAuthorizedFallback(params: {
    restaurantId: string;
    originalJobId: string;
    fallbackDeviceId: string;
    actorId?: string;
  }) {
    const original = await deviceRepository.findJob(params.restaurantId, params.originalJobId);
    if (!original) throw new DeviceServiceError("Original job not found.", 404);
    if (original.status === "UNKNOWN" || original.status === "MANUAL_REVIEW") {
      throw new DeviceServiceError(
        "Uncertain jobs require manual review before fallback reprint.",
        409,
        "MANUAL_REVIEW",
      );
    }
    const fallback = await deviceService.get(params.restaurantId, params.fallbackDeviceId);
    if (fallback.outletId !== original.outletId) {
      throw new DeviceServiceError("Fallback device outlet mismatch.", 403);
    }
    if (!fallback.configuration?.isFallback && fallback.printerRole !== "SECONDARY_RECEIPT") {
      throw new DeviceServiceError(
        "Target device is not marked as fallback or SECONDARY_RECEIPT.",
        400,
        "NOT_FALLBACK",
      );
    }

    const result = await deviceService.enqueuePrintJob({
      restaurantId: params.restaurantId,
      outletId: original.outletId,
      deviceId: fallback.id,
      orderId: original.orderId,
      jobType: original.jobType.includes("KOT") ? "REPRINT_KOT" : "REPRINT_RECEIPT",
      isReprint: true,
      actorId: params.actorId,
      payload: {
        ...original.payloadSnapshot,
        isReprint: true,
        fallbackFromJobId: original.id,
        fallbackAuthorizedBy: params.actorId,
      },
    });

    const device = await deviceService.get(params.restaurantId, original.deviceId);
    await deviceRepository.insertEvent(
      makeDeviceEvent(
        device,
        "AUTHORIZED_FALLBACK_PRINT",
        {
          originalJobId: original.id,
          fallbackJobId: result.job.id,
          fallbackDeviceId: fallback.id,
        },
        params.actorId,
      ),
    );
    return result;
  }

  async fleetInventory(restaurantId: string, outletId?: string) {
    const [devices, connectors, jobs] = await Promise.all([
      deviceRepository.listDevices(restaurantId, outletId),
      connectorRepository.listConnectors(restaurantId, outletId),
      deviceRepository.listJobs(restaurantId, { limit: 200 }),
    ]);
    const now = Date.now();

    const connectorViews = connectors.map((c) => {
      const stale =
        !c.lastHeartbeatAt ||
        now - new Date(c.lastHeartbeatAt).getTime() > CONNECTOR_OFFLINE_AFTER_MS;
      const assigned = devices.filter((d) => d.configuration?.connectorId === c.id);
      let displayStatus: "ONLINE" | "OFFLINE" | "DEGRADED" | "REVOKED" = "OFFLINE";
      if (c.status === "REVOKED") displayStatus = "REVOKED";
      else if (!stale && c.status === "ONLINE") {
        const unhealthy = assigned.some(
          (d) => d.connectionStatus === "ERROR" || d.healthStatus === "UNHEALTHY",
        );
        displayStatus = unhealthy ? "DEGRADED" : "ONLINE";
      } else displayStatus = "OFFLINE";

      const { credentialHash: _secret, ...safe } = c;
      void _secret;
      return {
        ...safe,
        displayStatus,
        assignedDeviceIds: assigned.map((d) => d.id),
        assignedDeviceCount: assigned.length,
      };
    });

    const deviceViews = devices.map((d) => {
      const deviceJobs = jobs.filter((j) => j.deviceId === d.id);
      const lastSuccess = deviceJobs.find((j) => j.status === "COMPLETED");
      const warnings: string[] = [];
      if (!d.enabled) warnings.push("disabled");
      if (d.adapterType === "CONNECTOR" && !d.configuration?.connectorId) {
        warnings.push("unassigned_connector");
      }
      if (d.adapterType === "CONNECTOR" && !String(d.configuration?.host ?? "").trim()) {
        warnings.push("missing_host");
      }
      const connector = connectors.find((c) => c.id === d.configuration?.connectorId);
      if (connector?.status === "REVOKED") warnings.push("connector_revoked");
      return {
        ...d,
        printerRole: d.printerRole ?? defaultPrinterRole(d.deviceType),
        lastSuccessfulJobAt: d.lastSuccessfulJobAt ?? lastSuccess?.completedAt,
        pendingJobs: deviceJobs.filter((j) => j.status === "QUEUED" || j.status === "PROCESSING")
          .length,
        warnings,
      };
    });

    return {
      devices: deviceViews,
      connectors: connectorViews,
      summary: {
        deviceCount: devices.length,
        connectorCount: connectors.length,
        onlineConnectors: connectorViews.filter((c) => c.displayStatus === "ONLINE").length,
        unassignedPhysical: deviceViews.filter((d) =>
          d.warnings.includes("unassigned_connector"),
        ).length,
      },
    };
  }
}

export const deviceFleetService = new DeviceFleetService();
