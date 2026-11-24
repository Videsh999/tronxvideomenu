import type { FeatureKey } from "@/types";

/** Human labels for Super Admin feature toggles. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  VIDEO_MENU: "Video menu",
  TABLE_MANAGEMENT: "Tables & QR",
  TABLE_ORDERING: "Guest QR ordering",
  ORDER_MANAGEMENT: "Orders",
  MEDIA_LIBRARY: "Media library",
  MENU_OFFERS: "Offers & Discounts",
  RESERVATIONS: "Reservations",
  CAPTAIN_ACCESS: "Captains",
  WIFI: "Guest Wi‑Fi",
  CUSTOM_THEME: "Custom theme",
  ANALYTICS: "Reports & analytics",
  MENU_IMPORT: "Excel menu import",
  POS: "POS",
  KITCHEN_DISPLAY: "Kitchen display",
  INVENTORY: "Inventory",
  PROCUREMENT: "Procurement",
  CRM_LOYALTY: "CRM & loyalty coupons",
  MULTI_OUTLET: "Multi-outlet / organization",
  AI_BUSINESS_ASSISTANT: "AI assistant",
  AI_SALES_FORECAST: "AI sales forecast",
  AI_INVENTORY_INTELLIGENCE: "AI inventory intel",
  AI_MENU_INTELLIGENCE: "AI menu intel",
  AI_OPERATIONAL_ALERTS: "AI operational alerts",
  HARDWARE_SIMULATOR: "Hardware simulator",
  HARDWARE_PRINTING: "Hardware printing",
  HARDWARE_CASH_DRAWER: "Cash drawer",
  HARDWARE_BARCODE: "Barcode",
  HARDWARE_PAYMENT_TERMINAL: "Payment terminal",
  HARDWARE_CUSTOMER_DISPLAY: "Customer display",
  HARDWARE_LOCAL_CONNECTOR: "Local hardware connector",
  INTERNAL_TRACKING: "Internal guest tracking",
};

export const FEATURE_GROUPS: { title: string; keys: FeatureKey[] }[] = [
  {
    title: "Guest menu",
    keys: ["VIDEO_MENU", "MEDIA_LIBRARY", "CUSTOM_THEME", "WIFI", "MENU_IMPORT"],
  },
  {
    title: "Offers & Discounts",
    keys: ["MENU_OFFERS"],
  },
  {
    title: "Floor & orders",
    keys: [
      "TABLE_MANAGEMENT",
      "TABLE_ORDERING",
      "ORDER_MANAGEMENT",
      "POS",
      "KITCHEN_DISPLAY",
      "CAPTAIN_ACCESS",
      "INTERNAL_TRACKING",
      "RESERVATIONS",
    ],
  },
  {
    title: "Back office",
    keys: ["INVENTORY", "PROCUREMENT", "CRM_LOYALTY", "ANALYTICS", "MULTI_OUTLET"],
  },
  {
    title: "AI Intelligence",
    keys: [
      "AI_BUSINESS_ASSISTANT",
      "AI_SALES_FORECAST",
      "AI_INVENTORY_INTELLIGENCE",
      "AI_MENU_INTELLIGENCE",
      "AI_OPERATIONAL_ALERTS",
    ],
  },
  {
    title: "Hardware",
    keys: [
      "HARDWARE_SIMULATOR",
      "HARDWARE_PRINTING",
      "HARDWARE_CASH_DRAWER",
      "HARDWARE_BARCODE",
      "HARDWARE_PAYMENT_TERMINAL",
      "HARDWARE_CUSTOMER_DISPLAY",
      "HARDWARE_LOCAL_CONNECTOR",
    ],
  },
];
