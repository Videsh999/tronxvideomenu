import type { Dish, DishMediaItem } from "@/types";

/**
 * Ordered media for a dish: the main video, the main photo, then gallery items.
 * Duplicate URLs are dropped, and videos are excluded when the video menu is off.
 */
export function getDishMedia(dish: Dish, videoMenuEnabled: boolean): DishMediaItem[] {
  const imageUrl = dish.imageUrl || dish.image || undefined;
  const videoUrl = dish.videoUrl || dish.video || undefined;
  const items: DishMediaItem[] = [];
  if (videoMenuEnabled && videoUrl) {
    items.push({ id: "main-video", type: "VIDEO", url: videoUrl, posterUrl: dish.videoPosterUrl || imageUrl });
  }
  if (imageUrl) items.push({ id: "main-image", type: "IMAGE", url: imageUrl });
  for (const item of dish.gallery ?? []) {
    if (item.type === "VIDEO" && !videoMenuEnabled) continue;
    items.push({ ...item, posterUrl: item.type === "VIDEO" ? item.posterUrl || imageUrl : undefined });
  }
  const seen = new Set<string>();
  return items.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
