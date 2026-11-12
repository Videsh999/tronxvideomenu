import { randomUUID } from "node:crypto";
import type { Captain } from "@/types";
import { CaptainModel } from "@/lib/db/models";
import { connectToDatabase } from "@/lib/db/mongodb";
import { toDomain } from "@/lib/db/mongo-mappers";

const toCaptain = (value: unknown) => toDomain<Captain>(value);

export class CaptainRepository {
  async findByRestaurantId(restaurantId: string) {
    await connectToDatabase();
    const captains = await CaptainModel.find({ restaurantId }).select("+passwordCiphertext +passwordIv +passwordAuthTag").sort({ name: 1 }).lean();
    return captains.map(toCaptain);
  }

  async findById(id: string) {
    await connectToDatabase();
    const captain = await CaptainModel.findOne({ id }).lean();
    return captain ? toCaptain(captain) : null;
  }

  async findCredentialsByRestaurant(restaurantId: string, id: string) {
    await connectToDatabase();
    const captain = await CaptainModel.findOne({ restaurantId, id })
      .select("+passwordCiphertext +passwordIv +passwordAuthTag")
      .lean();
    return captain ? toCaptain(captain) : null;
  }

  async findByRestaurantAndEmail(restaurantId: string, email: string) {
    await connectToDatabase();
    const captain = await CaptainModel.findOne({ restaurantId, email }).select("+passwordHash").lean();
    return captain ? toCaptain(captain) : null;
  }

  async findByEmail(email: string) {
    await connectToDatabase();
    const captains = await CaptainModel.find({ email: email.trim().toLowerCase(), isActive: true })
      .select("+passwordHash")
      .limit(11)
      .lean();
    return captains.map(toCaptain);
  }

  async create(input: Omit<Captain, "id" | "createdAt" | "updatedAt">) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const captain = await CaptainModel.create({ ...input, id: `captain-${randomUUID()}`, createdAt: now, updatedAt: now });
    return toCaptain(captain.toObject());
  }

  async updateForRestaurant(
    restaurantId: string,
    id: string,
    patch: Partial<
      Pick<
        Captain,
        | "isActive"
        | "name"
        | "employeeCode"
        | "assignedTableIds"
        | "permissions"
        | "lastActiveAt"
        | "passwordHash"
        | "passwordCiphertext"
        | "passwordIv"
        | "passwordAuthTag"
      >
    >,
  ) {
    await connectToDatabase();
    const captain = await CaptainModel.findOneAndUpdate(
      { restaurantId, id },
      { $set: { ...patch, updatedAt: new Date().toISOString() } },
      { new: true, runValidators: true },
    ).select("+passwordHash +passwordCiphertext +passwordIv +passwordAuthTag").lean();
    return captain ? toCaptain(captain) : null;
  }

  /** Activity heartbeat only — must not bump updatedAt (that would invalidate captain sessions). */
  async touchLastActiveAt(restaurantId: string, id: string, lastActiveAt: string) {
    await connectToDatabase();
    await CaptainModel.updateOne({ restaurantId, id }, { $set: { lastActiveAt } });
  }

  async findActiveByAssignedTable(restaurantId: string, tableId: string) {
    await connectToDatabase();
    const captains = await CaptainModel.find({
      restaurantId,
      isActive: true,
      assignedTableIds: tableId,
    })
      .lean();
    return captains.map(toCaptain);
  }

  async pullTableFromOthers(restaurantId: string, tableIds: string[], exceptCaptainId: string) {
    if (!tableIds.length) return;
    await connectToDatabase();
    await CaptainModel.updateMany(
      { restaurantId, id: { $ne: exceptCaptainId }, assignedTableIds: { $in: tableIds } },
      { $pull: { assignedTableIds: { $in: tableIds } }, $set: { updatedAt: new Date().toISOString() } },
    );
  }
}

export const captainRepository = new CaptainRepository();
