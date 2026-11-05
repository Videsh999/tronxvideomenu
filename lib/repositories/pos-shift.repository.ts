import { connectToDatabase } from "@/lib/db/mongodb";
import { PosShiftModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";
import type { PosShift } from "@/types";

export class PosShiftRepository {
  async findOpen(restaurantId: string): Promise<PosShift | null> {
    await connectToDatabase();
    const shift = await PosShiftModel.findOne({ restaurantId, status: "OPEN" }).lean();
    return shift ? toDomain<PosShift>(shift) : null;
  }

  async findById(restaurantId: string, id: string): Promise<PosShift | null> {
    await connectToDatabase();
    const shift = await PosShiftModel.findOne({ restaurantId, id }).lean();
    return shift ? toDomain<PosShift>(shift) : null;
  }

  async create(data: PosShift): Promise<PosShift> {
    await connectToDatabase();
    const created = await PosShiftModel.create(data);
    return toDomain<PosShift>(created.toObject());
  }

  async close(
    restaurantId: string,
    id: string,
    patch: Pick<PosShift, "closedAt" | "closedBy" | "closingCashCounted" | "expectedCash" | "notes">,
  ): Promise<PosShift | null> {
    await connectToDatabase();
    const updated = await PosShiftModel.findOneAndUpdate(
      { restaurantId, id, status: "OPEN" },
      { $set: { ...patch, status: "CLOSED" } },
      { new: true, runValidators: true },
    ).lean();
    return updated ? toDomain<PosShift>(updated) : null;
  }
}

export const posShiftRepository = new PosShiftRepository();
