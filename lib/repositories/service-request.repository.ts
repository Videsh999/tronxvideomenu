import { randomUUID } from "node:crypto";
import type { ServiceRequest, ServiceRequestStatus, ServiceRequestType } from "@/types/service-request";
import { connectToDatabase } from "@/lib/db/mongodb";
import { ServiceRequestModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";

export class ServiceRequestRepository {
  async create(input: {
    restaurantId: string;
    tableId: string;
    tableNumber: number;
    captainId?: string;
    type: ServiceRequestType;
    note?: string;
  }) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const created = await ServiceRequestModel.create({
      id: `sreq-${randomUUID()}`,
      restaurantId: input.restaurantId,
      tableId: input.tableId,
      tableNumber: input.tableNumber,
      captainId: input.captainId,
      type: input.type,
      note: input.note,
      status: "OPEN",
      createdAt: now,
      updatedAt: now,
    });
    return toDomain<ServiceRequest>(created.toObject());
  }

  async listOpenForRestaurant(restaurantId: string, tableIds?: string[]) {
    await connectToDatabase();
    const filter: Record<string, unknown> = {
      restaurantId,
      status: { $in: ["OPEN", "ACKNOWLEDGED", "IN_PROGRESS"] },
    };
    if (tableIds && tableIds.length > 0) {
      filter.tableId = { $in: tableIds };
    }
    const rows = await ServiceRequestModel.find(filter).sort({ createdAt: -1 }).lean();
    return rows.map((row) => toDomain<ServiceRequest>(row));
  }

  async listForTable(restaurantId: string, tableId: string) {
    await connectToDatabase();
    const rows = await ServiceRequestModel.find({ restaurantId, tableId })
      .sort({ createdAt: -1 })
      .limit(40)
      .lean();
    return rows.map((row) => toDomain<ServiceRequest>(row));
  }

  async updateStatus(
    restaurantId: string,
    id: string,
    status: ServiceRequestStatus,
  ) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const set: Record<string, unknown> = { status, updatedAt: now };
    if (status === "DONE" || status === "CANCELLED") set.completedAt = now;
    const row = await ServiceRequestModel.findOneAndUpdate(
      { restaurantId, id },
      { $set: set },
      { new: true, runValidators: true },
    ).lean();
    return row ? toDomain<ServiceRequest>(row) : null;
  }
}

export const serviceRequestRepository = new ServiceRequestRepository();
