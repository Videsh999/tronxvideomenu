import { connectToDatabase } from "@/lib/db/mongodb";
import { DeviceEventModel, HardwareDeviceModel, PrintJobModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";
import type {
  DeviceEventRecord,
  DeviceRecord,
  PrintJobRecord,
  PrintJobStatus,
} from "@/lib/devices/device.types";

export class DeviceRepository {
  async listDevices(restaurantId: string, outletId?: string): Promise<DeviceRecord[]> {
    await connectToDatabase();
    const filter: Record<string, unknown> = { restaurantId };
    if (outletId) filter.outletId = outletId;
    const rows = await HardwareDeviceModel.find(filter).sort({ createdAt: -1 }).lean();
    return rows.map((row) => toDomain<DeviceRecord>(row));
  }

  async findDevice(restaurantId: string, deviceId: string): Promise<DeviceRecord | null> {
    await connectToDatabase();
    const row = await HardwareDeviceModel.findOne({ restaurantId, id: deviceId }).lean();
    return row ? toDomain<DeviceRecord>(row) : null;
  }

  async insertDevices(devices: DeviceRecord[]): Promise<DeviceRecord[]> {
    await connectToDatabase();
    if (!devices.length) return [];
    await HardwareDeviceModel.insertMany(devices);
    return devices;
  }

  async updateDevice(
    restaurantId: string,
    deviceId: string,
    patch: Partial<DeviceRecord>,
  ): Promise<DeviceRecord | null> {
    await connectToDatabase();
    const unset: Record<string, ""> = {};
    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) unset[key] = "";
      else set[key] = value;
    }
    const update: Record<string, unknown> = { $set: set };
    if (Object.keys(unset).length) update.$unset = unset;
    const updated = await HardwareDeviceModel.findOneAndUpdate(
      { restaurantId, id: deviceId },
      update,
      { new: true },
    ).lean();
    return updated ? toDomain<DeviceRecord>(updated) : null;
  }

  async deleteDevice(restaurantId: string, deviceId: string): Promise<boolean> {
    await connectToDatabase();
    const result = await HardwareDeviceModel.deleteOne({ restaurantId, id: deviceId });
    return result.deletedCount > 0;
  }

  async insertEvent(event: DeviceEventRecord): Promise<DeviceEventRecord> {
    await connectToDatabase();
    await DeviceEventModel.create(event);
    return event;
  }

  async listEvents(
    restaurantId: string,
    opts?: { deviceId?: string; limit?: number },
  ): Promise<DeviceEventRecord[]> {
    await connectToDatabase();
    const filter: Record<string, unknown> = { restaurantId };
    if (opts?.deviceId) filter.deviceId = opts.deviceId;
    const rows = await DeviceEventModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(opts?.limit ?? 100)
      .lean();
    return rows.map((row) => toDomain<DeviceEventRecord>(row));
  }

  async findJobByDedupe(
    restaurantId: string,
    dedupeKey: string,
  ): Promise<PrintJobRecord | null> {
    await connectToDatabase();
    const row = await PrintJobModel.findOne({ restaurantId, dedupeKey }).lean();
    return row ? toDomain<PrintJobRecord>(row) : null;
  }

  async insertJob(job: PrintJobRecord): Promise<PrintJobRecord> {
    await connectToDatabase();
    await PrintJobModel.create(job);
    return job;
  }

  async updateJob(
    restaurantId: string,
    jobId: string,
    patch: Partial<PrintJobRecord>,
  ): Promise<PrintJobRecord | null> {
    await connectToDatabase();
    const unset: Record<string, ""> = {};
    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) {
        unset[key] = "";
      } else {
        set[key] = value;
      }
    }
    const update: Record<string, unknown> = { $set: set };
    if (Object.keys(unset).length) update.$unset = unset;
    const updated = await PrintJobModel.findOneAndUpdate(
      { restaurantId, id: jobId },
      update,
      { new: true },
    ).lean();
    return updated ? toDomain<PrintJobRecord>(updated) : null;
  }

  async listJobs(
    restaurantId: string,
    opts?: { status?: PrintJobStatus; limit?: number },
  ): Promise<PrintJobRecord[]> {
    await connectToDatabase();
    const filter: Record<string, unknown> = { restaurantId };
    if (opts?.status) filter.status = opts.status;
    const rows = await PrintJobModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(opts?.limit ?? 100)
      .lean();
    return rows.map((row) => toDomain<PrintJobRecord>(row));
  }

  async findJob(restaurantId: string, jobId: string): Promise<PrintJobRecord | null> {
    await connectToDatabase();
    const row = await PrintJobModel.findOne({ restaurantId, id: jobId }).lean();
    return row ? toDomain<PrintJobRecord>(row) : null;
  }
}

export const deviceRepository = new DeviceRepository();
