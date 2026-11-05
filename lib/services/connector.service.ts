import { randomUUID } from "crypto";
import {
  CONNECTOR_OFFLINE_AFTER_MS,
  generateConnectorSecret,
  generatePairingCode,
  hashPayload,
  hashSecret,
  PAIRING_CODE_TTL_MS,
  verifySecret,
} from "@/lib/devices/connector-crypto";
import { makeDeviceEvent } from "@/lib/devices/device-events";
import type {
  ConnectorStatus,
  DeviceConnectorRecord,
  DeviceRecord,
  PrintJobStatus,
} from "@/lib/devices/device.types";
import { connectorRepository } from "@/lib/repositories/connector.repository";
import { deviceRepository } from "@/lib/repositories/device.repository";

export class ConnectorServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code?: string,
  ) {
    super(message);
  }
}

const pairingRate = new Map<string, number[]>();

function assertPairingRateLimit(restaurantId: string) {
  const now = Date.now();
  const windowMs = 60_000;
  const recent = (pairingRate.get(restaurantId) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= 10) {
    throw new ConnectorServiceError("Too many pairing requests. Try again shortly.", 429, "RATE_LIMIT");
  }
  recent.push(now);
  pairingRate.set(restaurantId, recent);
}

export class ConnectorService {
  async createPairingCode(params: {
    restaurantId: string;
    outletId: string;
    organizationId?: string;
    createdBy: string;
  }) {
    assertPairingRateLimit(params.restaurantId);
    const code = generatePairingCode();
    const now = new Date();
    const record = {
      id: `pair-${randomUUID()}`,
      restaurantId: params.restaurantId,
      outletId: params.outletId,
      organizationId: params.organizationId,
      codeHash: hashSecret(code),
      expiresAt: new Date(now.getTime() + PAIRING_CODE_TTL_MS).toISOString(),
      createdBy: params.createdBy,
      createdAt: now.toISOString(),
    };
    await connectorRepository.createPairing(record);
    return {
      pairingId: record.id,
      code,
      expiresAt: record.expiresAt,
      outletId: record.outletId,
      // Plain code returned once to the authorized admin UI only.
    };
  }

  /**
   * Exchange a pairing code for connector credentials.
   * restaurant/outlet come from the pairing record — never from connector body.
   */
  async claimPairing(params: {
    code: string;
    hostname?: string;
    connectorName?: string;
    version?: string;
  }) {
    const codeHash = hashSecret(params.code.trim().toUpperCase());
    const pairing = await connectorRepository.findOpenPairingByHash(codeHash);
    if (!pairing) {
      throw new ConnectorServiceError("Invalid or already used pairing code.", 400, "INVALID_CODE");
    }
    if (new Date(pairing.expiresAt).getTime() < Date.now()) {
      throw new ConnectorServiceError("Pairing code expired.", 400, "EXPIRED");
    }

    const usedAt = new Date().toISOString();
    const claimed = await connectorRepository.markPairingUsed(pairing.id, usedAt);
    if (!claimed) {
      throw new ConnectorServiceError("Pairing code already used.", 400, "ALREADY_USED");
    }

    const secret = generateConnectorSecret();
    const now = usedAt;
    const connector: DeviceConnectorRecord = {
      id: `conn-${randomUUID()}`,
      restaurantId: pairing.restaurantId,
      outletId: pairing.outletId,
      organizationId: pairing.organizationId,
      name: params.connectorName?.trim() || `POS Connector (${params.hostname ?? "Windows"})`,
      credentialHash: hashSecret(secret),
      credentialVersion: 1,
      status: "ONLINE",
      version: params.version,
      hostname: params.hostname,
      lastHeartbeatAt: now,
      lastSeenAt: now,
      pairedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    await connectorRepository.createConnector(connector);

    // Seed a physical network receipt printer placeholder bound to this connector (admin fills IP).
    const deviceNow = now;
    const receiptPrinter: DeviceRecord = {
      id: `dev-${randomUUID()}`,
      organizationId: pairing.organizationId,
      restaurantId: pairing.restaurantId,
      outletId: pairing.outletId,
      name: "Network Receipt Printer (connector)",
      deviceType: "RECEIPT_PRINTER",
      manufacturer: "Generic",
      model: "ESC/POS Network",
      connectionType: "NETWORK",
      adapterType: "CONNECTOR",
      connectionStatus: "DISCONNECTED",
      healthStatus: "UNKNOWN",
      lastSeenAt: deviceNow,
      capabilities: ["PRINT_RECEIPT", "TEST_PAGE", "DRAWER_KICK"],
      configuration: {
        connectorId: connector.id,
        host: "",
        port: 9100,
        paperWidth: 80,
        encoding: "utf8",
        isDefault: true,
      },
      simulated: false,
      enabled: true,
      printerRole: "RECEIPT",
      createdAt: deviceNow,
      updatedAt: deviceNow,
    };
    const kitchenPrinter: DeviceRecord = {
      ...receiptPrinter,
      id: `dev-${randomUUID()}`,
      name: "Network Kitchen Printer (connector)",
      deviceType: "KITCHEN_PRINTER",
      kitchenStation: "MAIN",
      printerRole: "KITCHEN",
      capabilities: ["PRINT_KOT", "TEST_PAGE"],
      configuration: {
        connectorId: connector.id,
        host: "",
        port: 9100,
        paperWidth: 80,
        encoding: "utf8",
        kitchenStation: "MAIN",
      },
    };
    await deviceRepository.insertDevices([receiptPrinter, kitchenPrinter]);

    return {
      connectorId: connector.id,
      connectorSecret: secret,
      restaurantId: connector.restaurantId,
      outletId: connector.outletId,
      credentialVersion: 1,
      devices: [receiptPrinter, kitchenPrinter],
      note: "Store connectorSecret in OS credential store. It is shown once and never logged by the cloud.",
    };
  }

  async authenticateConnector(connectorId: string, secret: string): Promise<DeviceConnectorRecord> {
    const connector = await connectorRepository.findConnector(connectorId);
    if (!connector || connector.status === "REVOKED") {
      throw new ConnectorServiceError("Connector unauthorized.", 401, "UNAUTHORIZED");
    }
    if (!verifySecret(secret, connector.credentialHash)) {
      throw new ConnectorServiceError("Connector unauthorized.", 401, "UNAUTHORIZED");
    }
    return connector;
  }

  async heartbeat(
    connector: DeviceConnectorRecord,
    body: {
      version?: string;
      hostname?: string;
      devices?: Array<{ deviceId: string; health: string; connectionStatus: string }>;
    },
  ) {
    const now = new Date().toISOString();
    const updated = await connectorRepository.updateConnector(connector.id, {
      status: "ONLINE",
      version: body.version ?? connector.version,
      hostname: body.hostname ?? connector.hostname,
      lastHeartbeatAt: now,
      lastSeenAt: now,
    });
    for (const report of body.devices ?? []) {
      await deviceRepository.updateDevice(connector.restaurantId, report.deviceId, {
        healthStatus: report.health as DeviceRecord["healthStatus"],
        connectionStatus: report.connectionStatus as DeviceRecord["connectionStatus"],
        lastSeenAt: now,
      });
    }
    return updated;
  }

  async pollJobs(connector: DeviceConnectorRecord) {
    return connectorRepository.claimQueuedJobs({
      restaurantId: connector.restaurantId,
      outletId: connector.outletId,
      connectorId: connector.id,
    });
  }

  async ackJob(
    connector: DeviceConnectorRecord,
    jobId: string,
    result: {
      status: Extract<PrintJobStatus, "COMPLETED" | "FAILED" | "UNKNOWN" | "MANUAL_REVIEW" | "CANCELLED">;
      errorMessage?: string;
      payloadHash?: string;
    },
  ) {
    const job = await deviceRepository.findJob(connector.restaurantId, jobId);
    if (!job) throw new ConnectorServiceError("Job not found.", 404, "NOT_FOUND");
    if (job.outletId !== connector.outletId) {
      throw new ConnectorServiceError("Job outlet mismatch.", 403, "ISOLATION");
    }
    // Idempotent: already terminal
    if (["COMPLETED", "CANCELLED"].includes(job.status) && result.status === job.status) {
      return job;
    }
    if (job.status === "COMPLETED" && result.status !== "COMPLETED") {
      // Do not downgrade confirmed completion.
      return job;
    }

    const now = new Date().toISOString();
    const updated = await deviceRepository.updateJob(connector.restaurantId, jobId, {
      status: result.status,
      errorMessage: result.errorMessage,
      payloadHash: result.payloadHash ?? (job.payloadSnapshot ? hashPayload(job.payloadSnapshot) : undefined),
      completedAt:
        result.status === "COMPLETED" ||
        result.status === "FAILED" ||
        result.status === "UNKNOWN" ||
        result.status === "MANUAL_REVIEW"
          ? now
          : job.completedAt,
      leaseConnectorId: undefined,
      leaseExpiresAt: undefined,
    });

    const device = await deviceRepository.findDevice(connector.restaurantId, job.deviceId);
    if (device) {
      if (result.status === "COMPLETED") {
        await deviceRepository.updateDevice(connector.restaurantId, device.id, {
          lastSuccessfulJobAt: now,
          connectionStatus: "CONNECTED",
          healthStatus: "HEALTHY",
          lastSeenAt: now,
        });
      }
      await deviceRepository.insertEvent(
        makeDeviceEvent(device, "CONNECTOR_JOB_ACK", {
          jobId,
          status: result.status,
          errorMessage: result.errorMessage,
          connectorId: connector.id,
        }),
      );
    }
    return updated;
  }

  async rotateCredentials(connectorId: string, restaurantId: string) {
    const connector = await connectorRepository.findConnector(connectorId);
    if (!connector || connector.restaurantId !== restaurantId) {
      throw new ConnectorServiceError("Connector not found.", 404);
    }
    if (connector.status === "REVOKED") {
      throw new ConnectorServiceError("Connector is revoked.", 409);
    }
    const secret = generateConnectorSecret();
    const updated = await connectorRepository.updateConnector(connectorId, {
      credentialHash: hashSecret(secret),
      credentialVersion: connector.credentialVersion + 1,
      status: "OFFLINE",
    });
    return {
      connector: updated,
      connectorSecret: secret,
      note: "Previous secret is invalidated. Reconfigure the Windows connector.",
    };
  }

  async revoke(connectorId: string, restaurantId: string) {
    const connector = await connectorRepository.findConnector(connectorId);
    if (!connector || connector.restaurantId !== restaurantId) {
      throw new ConnectorServiceError("Connector not found.", 404);
    }
    const now = new Date().toISOString();
    return connectorRepository.updateConnector(connectorId, {
      status: "REVOKED",
      revokedAt: now,
      credentialHash: hashSecret(`revoked-${randomUUID()}`),
      credentialVersion: connector.credentialVersion + 1,
    });
  }

  async listForRestaurant(restaurantId: string) {
    const list = await connectorRepository.listConnectors(restaurantId);
    const devices = await deviceRepository.listDevices(restaurantId);
    const now = Date.now();
    return list.map((c) => {
      const stale =
        !c.lastHeartbeatAt ||
        now - new Date(c.lastHeartbeatAt).getTime() > CONNECTOR_OFFLINE_AFTER_MS;
      const assigned = devices.filter((d) => d.configuration?.connectorId === c.id);
      let displayStatus: "ONLINE" | "OFFLINE" | "DEGRADED" | "REVOKED" | ConnectorStatus =
        c.status;
      if (c.status === "REVOKED") displayStatus = "REVOKED";
      else if (stale) displayStatus = "OFFLINE";
      else if (c.status === "ONLINE") {
        const unhealthy = assigned.some(
          (d) => d.connectionStatus === "ERROR" || d.healthStatus === "UNHEALTHY",
        );
        displayStatus = unhealthy ? "DEGRADED" : "ONLINE";
      }
      const { credentialHash: _secret, ...safe } = c;
      void _secret;
      return {
        ...safe,
        displayStatus,
        assignedDeviceCount: assigned.length,
        physical: true,
      };
    });
  }

  listDevicesForConnector(connectorId: string) {
    return connectorRepository.listConnectorDevices(connectorId);
  }
}

export const connectorService = new ConnectorService();

/** Exported for unit tests without Mongo. */
export const __test = {
  generatePairingCode,
  hashSecret,
  verifySecret,
  PAIRING_CODE_TTL_MS,
};
