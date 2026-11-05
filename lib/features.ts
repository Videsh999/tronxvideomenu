import type { FeatureKey, SubscriptionPlan } from "@/types";

export const PLAN_ENTITLEMENTS: Record<SubscriptionPlan, FeatureKey[]> = {
  STARTER: [
    "VIDEO_MENU",
    "TABLE_MANAGEMENT",
    "TABLE_ORDERING",
    "ORDER_MANAGEMENT",
    "MEDIA_LIBRARY",
  ],
  PRO: [
    "VIDEO_MENU",
    "TABLE_MANAGEMENT",
    "TABLE_ORDERING",
    "ORDER_MANAGEMENT",
    "MEDIA_LIBRARY",
    "RESERVATIONS",
    "CAPTAIN_ACCESS",
    "MENU_IMPORT",
    "POS",
    "KITCHEN_DISPLAY",
    "INVENTORY",
    "CRM_LOYALTY",
  ],
  ENTERPRISE: [
    "VIDEO_MENU",
    "TABLE_MANAGEMENT",
    "TABLE_ORDERING",
    "ORDER_MANAGEMENT",
    "MEDIA_LIBRARY",
    "RESERVATIONS",
    "CAPTAIN_ACCESS",
    "WIFI",
    "CUSTOM_THEME",
    "ANALYTICS",
    "MENU_IMPORT",
    "POS",
    "KITCHEN_DISPLAY",
    "INVENTORY",
    "PROCUREMENT",
    "CRM_LOYALTY",
    "MULTI_OUTLET",
    "AI_BUSINESS_ASSISTANT",
    "AI_SALES_FORECAST",
    "AI_INVENTORY_INTELLIGENCE",
    "AI_MENU_INTELLIGENCE",
    "AI_OPERATIONAL_ALERTS",
    "HARDWARE_SIMULATOR",
    "HARDWARE_PRINTING",
    "HARDWARE_CASH_DRAWER",
    "HARDWARE_BARCODE",
    "HARDWARE_PAYMENT_TERMINAL",
    "HARDWARE_CUSTOMER_DISPLAY",
    "HARDWARE_LOCAL_CONNECTOR",
  ],
};

export const DEFAULT_PLAN: SubscriptionPlan = "PRO";

export function getRestaurantPlan(restaurant: { subscriptionPlan?: SubscriptionPlan }): SubscriptionPlan {
  return restaurant.subscriptionPlan ?? DEFAULT_PLAN;
}

export function hasRestaurantFeature(
  restaurant: {
    subscriptionPlan?: SubscriptionPlan;
    subscriptionEnabled?: boolean;
    featureOverrides?: Record<string, boolean>;
  },
  featureKey: FeatureKey,
): boolean {
  if (restaurant.subscriptionEnabled === false) return false;
  const plan = restaurant.subscriptionPlan ?? DEFAULT_PLAN;
  const planFeatures = PLAN_ENTITLEMENTS[plan] ?? PLAN_ENTITLEMENTS[DEFAULT_PLAN];

  const override = restaurant.featureOverrides?.[featureKey];
  if (typeof override === "boolean") {
    return override;
  }

  return planFeatures.includes(featureKey);
}
