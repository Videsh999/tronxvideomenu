import { restaurantRepository } from "@/lib/repositories/restaurant.repository";
import { categoryRepository } from "@/lib/repositories/category.repository";
import { dishRepository } from "@/lib/repositories/dish.repository";
import { addonRepository } from "@/lib/repositories/addon.repository";
import type { Restaurant, RestaurantMenu } from "@/types";
import type {
  CreateRestaurantInput,
  UpdateRestaurantInput,
} from "@/lib/validations";
import { toCustomerDish } from "@/lib/customer-dish-data";
import { normalizeRestaurant } from "@/lib/restaurant-normalize";
import type { RestaurantDeleteResult } from "@/lib/repositories/types";
import { mediaRepository } from "@/lib/repositories/media.repository";
import cloudinary from "@/lib/cloudinary";
import type { RestaurantWifiConfiguration } from "@/types";
import { encryptWifiPassword, decryptWifiPassword } from "@/lib/security/wifi-crypto";
import { getWifiCustomerDetails, resolveWifiConfigurationUpdate } from "@/lib/wifi-configuration";

export type RestaurantWifiAdminView = {
  ssid: string;
  security: RestaurantWifiConfiguration["security"];
  passwordConfigured: boolean;
};

export type RestaurantWifiCustomerView = {
  ssid: string;
  security: RestaurantWifiConfiguration["security"];
  password?: string;
};

function toWifiAdminView(wifi?: RestaurantWifiConfiguration): RestaurantWifiAdminView {
  return {
    ssid: wifi?.ssid ?? "",
    security: wifi?.security ?? "WPA2",
    passwordConfigured: Boolean(wifi?.passwordCiphertext && wifi.passwordIv && wifi.passwordAuthTag),
  };
}

export class RestaurantService {
  async getAll(): Promise<Restaurant[]> {
    return (await restaurantRepository.findAll()).map(normalizeRestaurant);
  }

  async getById(id: string): Promise<Restaurant | null> {
    const restaurant = await restaurantRepository.findById(id);
    return restaurant ? normalizeRestaurant(restaurant) : null;
  }

  async getBySlug(slug: string): Promise<Restaurant | null> {
    const restaurant = await restaurantRepository.findBySlug(slug);
    return restaurant ? normalizeRestaurant(restaurant) : null;
  }

  async getWifiAdminConfiguration(id: string): Promise<RestaurantWifiAdminView | null> {
    const restaurant = await restaurantRepository.findWifiById(id);
    return restaurant ? toWifiAdminView(restaurant.wifi) : null;
  }

  async updateWifiAdminConfiguration(
    id: string,
    input: { ssid: string; security: RestaurantWifiConfiguration["security"]; password?: string; clearPassword: boolean },
  ): Promise<RestaurantWifiAdminView | null> {
    const current = await restaurantRepository.findWifiById(id);
    if (!current) return null;

    const wifi = resolveWifiConfigurationUpdate(current.wifi, input, encryptWifiPassword);

    const updated = await restaurantRepository.updateWifiConfiguration(id, wifi);
    return updated ? toWifiAdminView(updated) : null;
  }

  async getWifiCustomerDetails(slug: string): Promise<RestaurantWifiCustomerView | null> {
    const restaurant = await restaurantRepository.findWifiBySlug(slug);
    if (!restaurant || restaurant.isActive === false || !restaurant.wifi?.ssid) return null;
    return getWifiCustomerDetails(restaurant.wifi, decryptWifiPassword);
  }

  async create(input: CreateRestaurantInput): Promise<Restaurant> {
    const existing = await restaurantRepository.findBySlug(input.slug);
    if (existing) {
      throw new Error(`A restaurant with slug '${input.slug}' already exists`);
    }
    return normalizeRestaurant(await restaurantRepository.create(input));
  }

  async update(
    id: string,
    input: UpdateRestaurantInput,
  ): Promise<Restaurant | null> {
    if (input.slug) {
      const existing = await restaurantRepository.findBySlug(input.slug);
      if (existing && existing.id !== id) {
        throw new Error(
          `Slug '${input.slug}' is already taken by another restaurant`,
        );
      }
    }
    const patch: UpdateRestaurantInput & Partial<Restaurant> = { ...input };
    if (patch.logoUrl !== undefined) patch.logo = patch.logoUrl;
    if (patch.coverUrl !== undefined) patch.coverImage = patch.coverUrl;
    if (patch.logo !== undefined) patch.logoUrl = patch.logo;
    if (patch.coverImage !== undefined) patch.coverUrl = patch.coverImage;

    if (patch.slug && patch.slug !== id) {
      const renamed = await restaurantRepository.renameIdentity(id, patch.slug, patch);
      return renamed ? normalizeRestaurant(renamed) : null;
    }

    const updated = await restaurantRepository.update(id, patch);
    return updated ? normalizeRestaurant(updated) : null;
  }

  async delete(id: string): Promise<RestaurantDeleteResult> {
    const restaurant = await restaurantRepository.findById(id);
    if (!restaurant) return { deleted: false, reason: "NOT_FOUND" };

    const media = await mediaRepository.findByRestaurantId(id);
    for (const asset of media) {
      if (asset.isExternal) continue;
      const result = await cloudinary.uploader.destroy(asset.publicId, {
        resource_type: asset.resourceType,
        invalidate: true,
      });
      if (result.result !== "ok" && result.result !== "not found") {
        throw new Error(`Cloudinary deletion failed: ${result.result}`);
      }
    }

    return restaurantRepository.delete(id);
  }

  async getFullMenu(idOrSlug: string): Promise<RestaurantMenu | null> {
    let restaurant = await restaurantRepository.findById(idOrSlug);
    if (!restaurant) {
      restaurant = await restaurantRepository.findBySlug(idOrSlug);
    }
    if (!restaurant) return null;
    if (restaurant.isActive === false) return null;

    const [categories, rawDishes, addonGroups] = await Promise.all([
      categoryRepository.findByRestaurantId(restaurant.id),
      dishRepository.findByRestaurantId(restaurant.id),
      addonRepository.findGroupsByRestaurantId(restaurant.id),
    ]);

    const dishes = rawDishes.map((dish) => toCustomerDish(dish, addonGroups));

    return {
      restaurant: normalizeRestaurant(restaurant),
      categories: categories.filter((c) => c.isActive),
      dishes,
    };
  }
}

export const restaurantService = new RestaurantService();
