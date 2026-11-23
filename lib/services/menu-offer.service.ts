import { invalidateRestaurantMenus } from "@/lib/cache/restaurant-menu";
import { menuOfferRepository } from "@/lib/repositories/menu-offer.repository";
import type { MenuOffer, OfferThemePreset } from "@/types";
import type { CreateMenuOfferInput, UpdateMenuOfferInput } from "@/lib/validations";

const defaultPresentation = (input?: CreateMenuOfferInput["presentation"]): MenuOffer["presentation"] => ({
  themePreset: (input?.themePreset as OfferThemePreset | undefined) ?? "NONE",
  bannerHeadline: input?.bannerHeadline?.trim() || undefined,
  bannerSubtext: input?.bannerSubtext?.trim() || undefined,
  badgeText: input?.badgeText?.trim() || undefined,
  applyTheme: input?.applyTheme ?? true,
});

class MenuOfferService {
  list(restaurantId: string) {
    return menuOfferRepository.list(restaurantId);
  }

  getActive(restaurantId: string) {
    return menuOfferRepository.findActive(restaurantId);
  }

  async create(restaurantId: string, input: CreateMenuOfferInput): Promise<MenuOffer> {
    const dishIds = input.scope === "SELECTED_DISHES" ? [...new Set(input.dishIds ?? [])] : [];
    if (input.scope === "SELECTED_DISHES" && dishIds.length === 0) {
      throw new MenuOfferServiceError("Select at least one dish for a selected-items offer.");
    }
    const offer = await menuOfferRepository.create({
      restaurantId,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      percentOff: input.percentOff,
      scope: input.scope,
      dishIds,
      startsAt: input.startsAt || undefined,
      endsAt: input.endsAt || undefined,
      isActive: input.isActive ?? false,
      presentation: defaultPresentation(input.presentation),
    });
    invalidateRestaurantMenus();
    return offer;
  }

  async update(restaurantId: string, id: string, input: UpdateMenuOfferInput): Promise<MenuOffer> {
    const existing = await menuOfferRepository.findById(restaurantId, id);
    if (!existing) throw new MenuOfferServiceError("Offer not found.", 404);

    const scope = input.scope ?? existing.scope;
    const dishIds =
      scope === "SELECTED_DISHES"
        ? [...new Set(input.dishIds ?? existing.dishIds)]
        : [];
    if (scope === "SELECTED_DISHES" && dishIds.length === 0) {
      throw new MenuOfferServiceError("Select at least one dish for a selected-items offer.");
    }

    const presentation = input.presentation
      ? {
          themePreset: input.presentation.themePreset ?? existing.presentation.themePreset,
          bannerHeadline:
            input.presentation.bannerHeadline !== undefined
              ? input.presentation.bannerHeadline.trim() || undefined
              : existing.presentation.bannerHeadline,
          bannerSubtext:
            input.presentation.bannerSubtext !== undefined
              ? input.presentation.bannerSubtext.trim() || undefined
              : existing.presentation.bannerSubtext,
          badgeText:
            input.presentation.badgeText !== undefined
              ? input.presentation.badgeText.trim() || undefined
              : existing.presentation.badgeText,
          applyTheme: input.presentation.applyTheme ?? existing.presentation.applyTheme,
        }
      : existing.presentation;

    const updated = await menuOfferRepository.update(restaurantId, id, {
      name: input.name?.trim() ?? existing.name,
      description:
        input.description !== undefined
          ? input.description.trim() || undefined
          : existing.description,
      percentOff: input.percentOff ?? existing.percentOff,
      scope,
      dishIds,
      startsAt: input.startsAt !== undefined ? input.startsAt || undefined : existing.startsAt,
      endsAt: input.endsAt !== undefined ? input.endsAt || undefined : existing.endsAt,
      isActive: input.isActive ?? existing.isActive,
      presentation,
    });
    if (!updated) throw new MenuOfferServiceError("Offer not found.", 404);
    invalidateRestaurantMenus();
    return updated;
  }

  async remove(restaurantId: string, id: string): Promise<void> {
    const ok = await menuOfferRepository.remove(restaurantId, id);
    if (!ok) throw new MenuOfferServiceError("Offer not found.", 404);
    invalidateRestaurantMenus();
  }
}

export class MenuOfferServiceError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "MenuOfferServiceError";
    this.status = status;
  }
}

export const menuOfferService = new MenuOfferService();
