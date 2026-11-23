import { randomUUID } from "node:crypto";
import { MenuOfferModel } from "@/lib/db/models";
import { connectToDatabase } from "@/lib/db/mongodb";
import { toDomain } from "@/lib/db/mongo-mappers";
import type { MenuOffer } from "@/types";
import { isMenuOfferLive } from "@/lib/offers/menu-offer";

export type MenuOfferWrite = Omit<MenuOffer, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};

class MenuOfferRepository {
  async list(restaurantId: string): Promise<MenuOffer[]> {
    await connectToDatabase();
    const rows = await MenuOfferModel.find({ restaurantId }).sort({ updatedAt: -1 }).lean();
    return rows.map((row) => toDomain<MenuOffer>(row));
  }

  async findById(restaurantId: string, id: string): Promise<MenuOffer | null> {
    await connectToDatabase();
    const row = await MenuOfferModel.findOne({ restaurantId, id }).lean();
    return row ? toDomain<MenuOffer>(row) : null;
  }

  /** Most recently updated active offer whose date window includes now. */
  async findActive(restaurantId: string, now = new Date()): Promise<MenuOffer | null> {
    await connectToDatabase();
    const rows = await MenuOfferModel.find({ restaurantId, isActive: true })
      .sort({ updatedAt: -1 })
      .lean();
    for (const row of rows) {
      const offer = toDomain<MenuOffer>(row);
      if (isMenuOfferLive(offer, now)) return offer;
    }
    return null;
  }

  async create(data: MenuOfferWrite): Promise<MenuOffer> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const id = data.id ?? `offer-${randomUUID()}`;
    if (data.isActive) {
      await MenuOfferModel.updateMany(
        { restaurantId: data.restaurantId, isActive: true },
        { $set: { isActive: false, updatedAt: now } },
      );
    }
    const created = await MenuOfferModel.create({
      ...data,
      id,
      dishIds: data.dishIds ?? [],
      createdAt: now,
      updatedAt: now,
    });
    return toDomain<MenuOffer>(created.toObject());
  }

  async update(
    restaurantId: string,
    id: string,
    patch: Partial<Omit<MenuOffer, "id" | "restaurantId" | "createdAt">>,
  ): Promise<MenuOffer | null> {
    await connectToDatabase();
    const now = new Date().toISOString();
    if (patch.isActive === true) {
      await MenuOfferModel.updateMany(
        { restaurantId, isActive: true, id: { $ne: id } },
        { $set: { isActive: false, updatedAt: now } },
      );
    }
    const row = await MenuOfferModel.findOneAndUpdate(
      { restaurantId, id },
      { $set: { ...patch, updatedAt: now } },
      { new: true },
    ).lean();
    return row ? toDomain<MenuOffer>(row) : null;
  }

  async remove(restaurantId: string, id: string): Promise<boolean> {
    await connectToDatabase();
    const result = await MenuOfferModel.deleteOne({ restaurantId, id });
    return result.deletedCount > 0;
  }
}

export const menuOfferRepository = new MenuOfferRepository();
