import { addonRepository } from "@/lib/repositories/addon.repository";
import { restaurantRepository } from "@/lib/repositories/restaurant.repository";
import type { Addon, AddonGroup } from "@/types";
import type {
  CreateAddonGroupInput,
  UpdateAddonGroupInput,
  CreateAddonInput,
  UpdateAddonInput,
} from "@/lib/validations";
import { invalidateRestaurantMenus } from "@/lib/cache/restaurant-menu";

export class AddonService {
  async getGroupsByRestaurantId(restaurantId: string): Promise<AddonGroup[]> {
    return addonRepository.findGroupsByRestaurantId(restaurantId);
  }

  async getGroupById(id: string): Promise<AddonGroup | null> {
    return addonRepository.findGroupById(id);
  }

  async createGroup(input: CreateAddonGroupInput): Promise<AddonGroup> {
    const restaurant = await restaurantRepository.findById(input.restaurantId);
    if (!restaurant) {
      throw new Error("Restaurant not found");
    }
    const created = await addonRepository.createGroup(input);
    invalidateRestaurantMenus();
    return created;
  }

  async updateGroup(
    id: string,
    input: UpdateAddonGroupInput,
  ): Promise<AddonGroup | null> {
    const updated = await addonRepository.updateGroup(id, input);
    if (updated) invalidateRestaurantMenus();
    return updated;
  }

  async deleteGroup(id: string): Promise<boolean> {
    const deleted = await addonRepository.deleteGroup(id);
    if (deleted) invalidateRestaurantMenus();
    return deleted;
  }

  async getAddonsByGroupId(groupId: string): Promise<Addon[]> {
    return addonRepository.findAddonsByGroupId(groupId);
  }

  async getAddonById(id: string): Promise<Addon | null> {
    return addonRepository.findAddonById(id);
  }

  async createAddon(input: CreateAddonInput): Promise<Addon> {
    const group = await addonRepository.findGroupById(input.addonGroupId);
    if (!group) {
      throw new Error("Add-on group not found");
    }
    const created = await addonRepository.createAddon(input);
    invalidateRestaurantMenus();
    return created;
  }

  async updateAddon(
    id: string,
    input: UpdateAddonInput,
  ): Promise<Addon | null> {
    const updated = await addonRepository.updateAddon(id, input);
    if (updated) invalidateRestaurantMenus();
    return updated;
  }

  async deleteAddon(id: string): Promise<boolean> {
    const deleted = await addonRepository.deleteAddon(id);
    if (deleted) invalidateRestaurantMenus();
    return deleted;
  }
}

export const addonService = new AddonService();
