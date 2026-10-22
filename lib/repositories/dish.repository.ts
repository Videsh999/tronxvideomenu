import type { Dish } from "@/types";
import type { IDishRepository } from "./types";
import { connectToDatabase } from "@/lib/db/mongodb";
import { DishModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";

export class DishRepository implements IDishRepository {
  async findByRestaurantId(restaurantId: string): Promise<Dish[]> {
    await connectToDatabase();
    const dishes = await DishModel.find({ restaurantId })
      .sort({ sortOrder: 1 })
      .lean();
    return dishes.map((dish) => toDomain<Dish>(dish));
  }

  async findByCategoryId(categoryId: string): Promise<Dish[]> {
    await connectToDatabase();
    const dishes = await DishModel.find({ categoryId })
      .sort({ sortOrder: 1 })
      .lean();
    return dishes.map((dish) => toDomain<Dish>(dish));
  }

  async hasMediaReference(
    restaurantId: string,
    mediaUrl: string,
  ): Promise<boolean> {
    await connectToDatabase();
    const dish = await DishModel.exists({
      restaurantId,
      $or: [
        { imageUrl: mediaUrl },
        { videoUrl: mediaUrl },
        { videoPosterUrl: mediaUrl },
        { image: mediaUrl },
        { video: mediaUrl },
        { "gallery.url": mediaUrl },
        { "gallery.posterUrl": mediaUrl },
      ],
    });
    return Boolean(dish);
  }

  async findById(id: string): Promise<Dish | null> {
    await connectToDatabase();
    const dish = await DishModel.findOne({ id }).lean();
    return dish ? toDomain<Dish>(dish) : null;
  }

  async create(
    data: Omit<Dish, "id" | "createdAt" | "updatedAt">,
  ): Promise<Dish> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const id = `dish-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newDish = {
      ...data,
      id,
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, "-"),
      isVeg: data.type === "VEG",
      createdAt: now,
      updatedAt: now,
    };
    const created = await DishModel.create(newDish);
    return toDomain<Dish>(created.toObject());
  }

  async update(id: string, data: Partial<Dish>): Promise<Dish | null> {
    await connectToDatabase();
    const existing = await DishModel.findOne({ id }).lean();
    if (!existing) return null;

    const existingDish = toDomain<Dish>(existing);
    const updated = await DishModel.findOneAndUpdate(
      { id },
      {
        $set: {
          ...data,
          id,
          isVeg:
            data.type !== undefined
              ? data.type === "VEG"
              : (data.isVeg ?? existingDish.isVeg),
          updatedAt: new Date().toISOString(),
        },
      },
      { new: true, runValidators: true },
    ).lean();
    return updated ? toDomain<Dish>(updated) : null;
  }

  async delete(id: string): Promise<boolean> {
    await connectToDatabase();
    const result = await DishModel.deleteOne({ id });
    return result.deletedCount === 1;
  }
}

export const dishRepository = new DishRepository();
