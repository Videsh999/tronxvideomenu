/** Drop the shared guest-menu cache after a menu edit. Safe outside a Next request. */
export function invalidateRestaurantMenus() {
  void import("next/cache")
    .then(({ revalidateTag }) => {
      revalidateTag("restaurant-menus", "max");
    })
    .catch(() => undefined);
}
