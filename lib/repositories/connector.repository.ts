import { connectToDatabase } from "@/lib/db/mongodb";
import {
  ConnectorPairingCodeModel,
  DeviceConnectorModel,
  HardwareDeviceModel,
  PrintJobModel,
} from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";
import { PRINT_JOB_LEASE_MS } from "@/lib/devices/device.types";
import type {
  ConnectorPairingCodeRecord,
  DeviceConnectorRecord,
  DeviceRecord,
  PrintJobRecord,
} from "@/lib/devices/device.types";

export class ConnectorRepository {
  async createPairing(code: ConnectorPairingCodeRecord) {
    await connectToDatabase();
    await ConnectorPairingCodeModel.create(code);
    return code;
  }

  async findOpenPairingByHash(codeHash: string): Promise<ConnectorPairingCodeRecord | null> {
    await connectToDatabase();
    const row = await ConnectorPairingCodeModel.findOne({
      codeHash,
      usedAt: { $exists: false },
    }).lean();
    return row ? toDomain<ConnectorPairingCodeRecord>(row) : null;
  }

  async markPairingUsed(id: string, usedAt: string): Promise<boolean> {
    await connectToDatabase();
    const result = await ConnectorPairingCodeModel.findOneAndUpdate(
      { id, $or: [{ usedAt: { $exists: false } }, { usedAt: null }] },
      { $set: { usedAt } },
      { new: true },
    ).lean();
    return Boolean(result);
  }

  async createConnector(connector: DeviceConnectorRecord) {
    await connectToDatabase();
    await DeviceConnectorModel.create(connector);
    return connector;
  }

  async findConnector(id: string): Promise<DeviceConnectorRecord | null> {
    await connectToDatabase();
    const row = await DeviceConnectorModel.findOne({ id }).lean();
    return row ? toDomain<DeviceConnectorRecord>(row) : null;
  }

  async listConnectors(restaurantId: string, outletId?: string): Promise<DeviceConnectorRecord[]> {
    await connectToDatabase();
    const filter: Record<string, unknown> = { restaurantId };
    if (outletId) filter.outletId = outletId;
    const rows = await DeviceConnectorModel.find(filter).sort({ createdAt: -1 }).lean();
    return rows.map((r) => toDomain<DeviceConnectorRecord>(r));
  }

  async updateConnector(id: string, patch: Partial<DeviceConnectorRecord>) {
    await connectToDatabase();
    const updated = await DeviceConnectorModel.findOneAndUpdate(
      { id },
      { $set: { ...patch, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();
    return updated ? toDomain<DeviceConnectorRecord>(updated) : null;
  }

  async listConnectorDevices(connectorId: string): Promise<DeviceRecord[]> {
    await connectToDatabase();
    const rows = await HardwareDeviceModel.find({
      "configuration.connectorId": connectorId,
      enabled: true,
    }).lean();
    return rows.map((r) => toDomain<DeviceRecord>(r));
  }

  /** Return expired PROCESSING leases to QUEUED for safe recovery. */
  async recoverExpiredLeases(restaurantId: string, outletId: string): Promise<number> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const result = await PrintJobModel.updateMany(
      {
        restaurantId,
        outletId,
        status: "PROCESSING",
        leaseExpiresAt: { $lt: now },
      },
      {
        $set: {
          status: "QUEUED",
          updatedAt: now,
        },
        $unset: { leaseConnectorId: "", leaseExpiresAt: "", connectorId: "" },
      },
    );
    return result.modifiedCount ?? 0;
  }

  /**
   * Atomically claim QUEUED jobs for devices assigned to this connector.
   * Two connectors cannot claim the same job (status must still be QUEUED).
   */
  async claimQueuedJobs(params: {
    restaurantId: string;
    outletId: string;
    connectorId: string;
    limit?: number;
  }): Promise<PrintJobRecord[]> {
    await connectToDatabase();
    await this.recoverExpiredLeases(params.restaurantId, params.outletId);

    const devices = await this.listConnectorDevices(params.connectorId);
    const deviceIds = devices.map((d) => d.id);
    if (!deviceIds.length) return [];

    const jobs = await PrintJobModel.find({
      restaurantId: params.restaurantId,
      outletId: params.outletId,
      deviceId: { $in: deviceIds },
      status: "QUEUED",
    })
      .sort({ createdAt: 1 })
      .limit(params.limit ?? 20)
      .lean();

    const claimed: PrintJobRecord[] = [];
    const now = Date.now();
    const leaseExpiresAt = new Date(now + PRINT_JOB_LEASE_MS).toISOString();

    for (const job of jobs) {
      const updated = await PrintJobModel.findOneAndUpdate(
        { id: job.id, status: "QUEUED" },
        {
          $set: {
            status: "PROCESSING",
            connectorId: params.connectorId,
            leaseConnectorId: params.connectorId,
            leaseExpiresAt,
            updatedAt: new Date().toISOString(),
          },
          $inc: { attemptCount: 1 },
        },
        { new: true },
      ).lean();
      if (updated) claimed.push(toDomain<PrintJobRecord>(updated));
    }
    return claimed;
  }
}

export const connectorRepository = new ConnectorRepository();
