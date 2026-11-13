import { dishRepository } from "@/lib/repositories/dish.repository";
import { addonRepository } from "@/lib/repositories/addon.repository";
import { categoryRepository } from "@/lib/repositories/category.repository";
import type { AddonGroup, Dish } from "@/types";
import type { CreateDishInput, UpdateDishInput } from "@/lib/validations";
import { resolveDishAddonGroups } from "@/lib/dish-addons";
import { invalidateRestaurantMenus } from "@/lib/cache/restaurant-menu";

async function hydrateAddonGroupsForDish(
  restaurantId: string,
  addonGroupIds: string[],
): Promise<AddonGroup[]> {
  if (addonGroupIds.length === 0) return [];
  const groups = await addonRepository.findGroupsByRestaurantId(restaurantId);
  const groupsById = new Map(groups.map((group) => [group.id, group]));
  const missingGroupId = addonGroupIds.find((id) => !groupsById.has(id));
  if (missingGroupId) {
    throw new Error(
      `Add-on group '${missingGroupId}' does not belong to this restaurant`,
    );
  }
  return resolveDishAddonGroups({ addonGroupIds } as Dish, groups);
}

async function validateCategory(
  categoryId: string,
  restaurantId: string,
): Promise<void> {
  const category = await categoryRepository.findById(categoryId);
  if (!category || category.restaurantId !== restaurantId) {
    throw new Error(
      `Category '${categoryId}' does not belong to this restaurant`,
    );
  }
}

export class DishService {
  async getByRestaurantId(restaurantId: string): Promise<Dish[]> {
    return dishRepository.findByRestaurantId(restaurantId);
  }

  async getByCategoryId(categoryId: string): Promise<Dish[]> {
    return dishRepository.findByCategoryId(categoryId);
  }

  async getById(id: string): Promise<Dish | null> {
    return dishRepository.findById(id);
  }

  async hasMediaReference(
    restaurantId: string,
    mediaUrl: string,
  ): Promise<boolean> {
    return dishRepository.hasMediaReference(restaurantId, mediaUrl);
  }

  async create(input: CreateDishInput): Promise<Dish> {
    await validateCategory(input.categoryId, input.restaurantId);
    const addonGroupIds = input.addonGroupIds ?? [];
    const addonGroups = await hydrateAddonGroupsForDish(
      input.restaurantId,
      addonGroupIds,
    );

    const created = await dishRepository.create({
      ...input,
      addonGroupIds,
      addonGroups,
      isCustomizable: input.isCustomizable ?? addonGroupIds.length > 0,
      isVeg: input.type === "VEG",
    });
    invalidateRestaurantMenus();
    return created;
  }

  async update(id: string, input: UpdateDishInput): Promise<Dish | null> {
    const existing = await dishRepository.findById(id);
    if (!existing) return null;

    const restaurantId = existing.restaurantId || "";
    if (input.categoryId !== undefined) {
      await validateCategory(input.categoryId, restaurantId);
    }
    const addonGroupIds =
      input.addonGroupIds !== undefined
        ? input.addonGroupIds
        : (existing.addonGroupIds ??
          existing.addonGroups?.map((g) => g.id) ??
          []);

    const addonGroups =
      input.addonGroupIds !== undefined
        ? await hydrateAddonGroupsForDish(restaurantId, addonGroupIds)
        : existing.addonGroups;

    const updated = await dishRepository.update(id, {
      ...input,
      addonGroupIds,
      addonGroups,
      isCustomizable:
        input.isCustomizable ??
        (input.addonGroupIds !== undefined
          ? addonGroupIds.length > 0
          : existing.isCustomizable),
      isVeg: input.type !== undefined ? input.type === "VEG" : existing.isVeg,
    });
    if (updated) invalidateRestaurantMenus();
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const deleted = await dishRepository.delete(id);
    if (deleted) invalidateRestaurantMenus();
    return deleted;
  }
}

export const dishService = new DishService();
