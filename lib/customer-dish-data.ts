import type { AddonGroup, Dish } from "@/types";
import { resolveDishAddonGroups } from "@/lib/dish-addons";

const legacyDemoVideoUrls: Record<string, string> = {
  "/videos/food-video-1.mp4": "/videos/demo-video-1.mp4",
  "/videos/food-video-2.mp4": "/videos/demo-video-2.mp4",
};

/** Normalize legacy media fields and attach only the dish's active add-on data. */
export function toCustomerDish(dish: Dish, restaurantAddonGroups: AddonGroup[]): Dish {
  const imageUrl = dish.imageUrl || dish.image || undefined;
  const storedVideoUrl = dish.videoUrl || dish.video || undefined;
  const videoUrl = storedVideoUrl
    ? legacyDemoVideoUrls[storedVideoUrl] ?? storedVideoUrl
    : undefined;

  return {
    ...dish,
    imageUrl,
    videoUrl,
    videoPosterUrl: dish.videoPosterUrl || imageUrl,
    addonGroups: resolveDishAddonGroups(dish, restaurantAddonGroups),
  };
}
