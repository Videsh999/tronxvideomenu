export type LegacyRestaurantAdminConfig = {
  restaurantSlug: string;
  email?: string;
  password?: string;
};

export function getLegacyRestaurantAdminConfigs(): LegacyRestaurantAdminConfig[] {
  return [
    {
      restaurantSlug: process.env.MOAI_KITCHEN_ADMIN_RESTAURANT_SLUG || "moai-kitchen",
      email: process.env.MOAI_KITCHEN_ADMIN_EMAIL,
      password: process.env.MOAI_KITCHEN_ADMIN_PASSWORD,
    },
    {
      restaurantSlug: process.env.NATIVE_SOUTH_ADMIN_RESTAURANT_SLUG || "native-south",
      email: process.env.NATIVE_SOUTH_ADMIN_EMAIL,
      password: process.env.NATIVE_SOUTH_ADMIN_PASSWORD,
    },
  ];
}

export function getLegacyRestaurantAdminConfig(slug: string) {
  const normalizedSlug = slug.trim().toLowerCase();
  return getLegacyRestaurantAdminConfigs().find(
    (config) => config.restaurantSlug.trim().toLowerCase() === normalizedSlug,
  );
}
