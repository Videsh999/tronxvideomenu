import type { Restaurant, RestaurantWifiConfiguration } from "@/types";
import type { IRestaurantRepository, RestaurantDeleteResult } from "./types";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
  AddonModel,
  AddonGroupModel,
  CaptainModel,
  CategoryModel,
  DishModel,
  MediaModel,
  OrderCounterModel,
  OrderModel,
  ReservationModel,
  RestaurantAdminAccountModel,
  RestaurantModel,
  TableModel,
} from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";

export class RestaurantRepository implements IRestaurantRepository {
  async findAll(): Promise<Restaurant[]> {
    await connectToDatabase();
    const restaurants = await RestaurantModel.find().lean();
    return restaurants.map((restaurant) => toDomain<Restaurant>(restaurant));
  }

  async findById(id: string): Promise<Restaurant | null> {
    await connectToDatabase();
    const restaurant = await RestaurantModel.findOne({ id }).lean();
    return restaurant ? toDomain<Restaurant>(restaurant) : null;
  }

  async findBySlug(slug: string): Promise<Restaurant | null> {
    await connectToDatabase();
    const restaurant = await RestaurantModel.findOne({
      slug: { $regex: `^${escapeRegExp(slug)}$`, $options: "i" },
    }).lean();
    return restaurant ? toDomain<Restaurant>(restaurant) : null;
  }

  async findWifiById(id: string): Promise<Pick<Restaurant, "isActive" | "wifi"> | null> {
    await connectToDatabase();
    const restaurant = await RestaurantModel.findOne({ id }, { id: 1, isActive: 1, wifi: 1 }).lean();
    return restaurant ? { isActive: restaurant.isActive, wifi: restaurant.wifi as RestaurantWifiConfiguration | undefined } : null;
  }

  async findWifiBySlug(slug: string): Promise<Pick<Restaurant, "isActive" | "wifi"> | null> {
    await connectToDatabase();
    const restaurant = await RestaurantModel.findOne(
      { slug: { $regex: `^${escapeRegExp(slug)}$`, $options: "i" } },
      { id: 1, isActive: 1, wifi: 1 },
    ).lean();
    return restaurant ? { isActive: restaurant.isActive, wifi: restaurant.wifi as RestaurantWifiConfiguration | undefined } : null;
  }

  async updateWifiConfiguration(id: string, wifi: RestaurantWifiConfiguration): Promise<RestaurantWifiConfiguration | null> {
    await connectToDatabase();
    const updated = await RestaurantModel.findOneAndUpdate(
      { id },
      { $set: { wifi, updatedAt: new Date().toISOString() } },
      { returnDocument: "after", runValidators: true, projection: { wifi: 1 } },
    ).lean();
    return updated?.wifi as RestaurantWifiConfiguration | undefined ?? null;
  }

  async create(
    data: Omit<Restaurant, "id" | "createdAt" | "updatedAt">,
  ): Promise<Restaurant> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const newRestaurant = {
      ...data,
      id: data.slug,
      createdAt: now,
      updatedAt: now,
    };
    const created = await RestaurantModel.create(newRestaurant);
    return toDomain<Restaurant>(created.toObject());
  }

  async update(
    id: string,
    data: Partial<Restaurant>,
  ): Promise<Restaurant | null> {
    await connectToDatabase();
    const updated = await RestaurantModel.findOneAndUpdate(
      { id },
      { $set: { ...data, id, updatedAt: new Date().toISOString() } },
      { returnDocument: "after", runValidators: true },
    ).lean();
    return updated ? toDomain<Restaurant>(updated) : null;
  }

  async renameIdentity(
    id: string,
    newSlug: string,
    data: Partial<Restaurant>,
  ): Promise<Restaurant | null> {
    await connectToDatabase();
    const updated = await RestaurantModel.findOneAndUpdate(
      { id },
      {
        $set: {
          ...data,
          id: newSlug,
          slug: newSlug,
          updatedAt: new Date().toISOString(),
        },
      },
      { returnDocument: "after", runValidators: true },
    ).lean();
    if (!updated) return null;

    try {
      const migrationResults = await Promise.allSettled([
        CategoryModel.updateMany(
          { restaurantId: id },
          { $set: { restaurantId: newSlug } },
        ),
        DishModel.updateMany(
          { restaurantId: id },
          { $set: { restaurantId: newSlug } },
        ),
        AddonGroupModel.updateMany(
          { restaurantId: id },
          { $set: { restaurantId: newSlug } },
        ),
        MediaModel.updateMany(
          { restaurantId: id },
          { $set: { restaurantId: newSlug } },
        ),
        TableModel.updateMany({ restaurantId: id }, { $set: { restaurantId: newSlug } }),
        OrderModel.updateMany({ restaurantId: id }, { $set: { restaurantId: newSlug } }),
        OrderCounterModel.updateMany({ restaurantId: id }, { $set: { restaurantId: newSlug } }),
        ReservationModel.updateMany({ restaurantId: id }, { $set: { restaurantId: newSlug } }),
        CaptainModel.updateMany({ restaurantId: id }, { $set: { restaurantId: newSlug } }),
        RestaurantAdminAccountModel.updateMany({ restaurantId: id }, { $set: { restaurantId: newSlug } }),
      ]);
      const migrationFailure = migrationResults.find((result) => result.status === "rejected");
      if (migrationFailure?.status === "rejected") throw migrationFailure.reason;
    } catch (error) {
      await Promise.allSettled([
        CategoryModel.updateMany(
          { restaurantId: newSlug },
          { $set: { restaurantId: id } },
        ),
        DishModel.updateMany(
          { restaurantId: newSlug },
          { $set: { restaurantId: id } },
        ),
        AddonGroupModel.updateMany(
          { restaurantId: newSlug },
          { $set: { restaurantId: id } },
        ),
        MediaModel.updateMany(
          { restaurantId: newSlug },
          { $set: { restaurantId: id } },
        ),
        TableModel.updateMany({ restaurantId: newSlug }, { $set: { restaurantId: id } }),
        OrderModel.updateMany({ restaurantId: newSlug }, { $set: { restaurantId: id } }),
        OrderCounterModel.updateMany({ restaurantId: newSlug }, { $set: { restaurantId: id } }),
        ReservationModel.updateMany({ restaurantId: newSlug }, { $set: { restaurantId: id } }),
        CaptainModel.updateMany({ restaurantId: newSlug }, { $set: { restaurantId: id } }),
        RestaurantAdminAccountModel.updateMany({ restaurantId: newSlug }, { $set: { restaurantId: id } }),
        RestaurantModel.updateOne(
          { id: newSlug },
          {
            $set: {
              ...data,
              id,
              slug: id,
              updatedAt: new Date().toISOString(),
            },
          },
        ),
      ]);
      throw error;
    }

    return toDomain<Restaurant>(updated);
  }

  async delete(id: string): Promise<RestaurantDeleteResult> {
    await connectToDatabase();
    const restaurant = await RestaurantModel.findOne({ id }, { id: 1 }).lean();
    if (!restaurant) return { deleted: false, reason: "NOT_FOUND" };

    const groups = await AddonGroupModel.find(
      { restaurantId: id },
      { id: 1 },
    ).lean();
    const groupIds = groups.map((group) => group.id);

    await AddonModel.deleteMany({ addonGroupId: { $in: groupIds } });
    await AddonGroupModel.deleteMany({ restaurantId: id });
    await DishModel.deleteMany({ restaurantId: id });
    await CategoryModel.deleteMany({ restaurantId: id });
    await MediaModel.deleteMany({ restaurantId: id });

    const result = await RestaurantModel.deleteOne({ id });
    return result.deletedCount === 1
      ? { deleted: true }
      : { deleted: false, reason: "NOT_FOUND" };
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const restaurantRepository = new RestaurantRepository();
