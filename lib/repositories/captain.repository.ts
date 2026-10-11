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

  async create(input: Omit<Captain, "id" | "createdAt" | "updatedAt">) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const captain = await CaptainModel.create({ ...input, id: `captain-${randomUUID()}`, createdAt: now, updatedAt: now });
    return toCaptain(captain.toObject());
  }

  async updateForRestaurant(restaurantId: string, id: string, patch: Partial<Pick<Captain, "isActive" | "passwordHash" | "passwordCiphertext" | "passwordIv" | "passwordAuthTag">>) {
    await connectToDatabase();
    const captain = await CaptainModel.findOneAndUpdate(
      { restaurantId, id },
      { $set: { ...patch, updatedAt: new Date().toISOString() } },
      { new: true, runValidators: true },
    ).select("+passwordHash +passwordCiphertext +passwordIv +passwordAuthTag").lean();
    return captain ? toCaptain(captain) : null;
  }
}

export const captainRepository = new CaptainRepository();
