/**
 * Idempotent enterprise demo outlet: Cheese.
 * Reuses the TRONX demo kitchen workbook; turns every FeatureKey on.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { connectToDatabase } from "@/lib/db/mongodb";
import { CategoryModel, DishModel, RestaurantModel, TableModel } from "@/lib/db/models";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";
import { captainService } from "@/lib/services/captain.service";
import type { FeatureKey } from "@/types";
import { hasRestaurantFeature } from "@/lib/features";
import { menuOfferService } from "@/lib/services/menu-offer.service";
import { deviceService } from "@/lib/services/device.service";
import { invalidateRestaurantMenus } from "@/lib/cache/restaurant-menu";

export const CHEESE_DEMO = {
  restaurantId: "cheese",
  slug: "cheese",
  adminEmail: "cheese@tronx.local",
  adminPassword: "CheeseDemo!2026",
  captainEmail: "captain@cheese.local",
  captainPassword: "CheeseCap!2026",
  captainName: "Cheese Floor",
} as const;

const ALL_FEATURE_KEYS: FeatureKey[] = [
  "VIDEO_MENU",
  "TABLE_MANAGEMENT",
  "TABLE_ORDERING",
  "ORDER_MANAGEMENT",
  "MEDIA_LIBRARY",
  "MENU_OFFERS",
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
  "AI_GUEST_MENU",
  "HARDWARE_SIMULATOR",
  "HARDWARE_PRINTING",
  "HARDWARE_CASH_DRAWER",
  "HARDWARE_BARCODE",
  "HARDWARE_PAYMENT_TERMINAL",
  "HARDWARE_CUSTOMER_DISPLAY",
  "HARDWARE_LOCAL_CONNECTOR",
  "INTERNAL_TRACKING",
];

function allFeatureOverridesOn(): Record<FeatureKey, boolean> {
  return Object.fromEntries(ALL_FEATURE_KEYS.map((key) => [key, true])) as Record<
    FeatureKey,
    boolean
  >;
}

async function upsertById(
  model: { updateOne: (f: object, u: object, o?: object) => Promise<unknown> },
  id: string,
  doc: Record<string, unknown>,
) {
  await model.updateOne({ id }, { $set: { ...doc, id } }, { upsert: true });
}

function loadMenuRows(): Record<string, unknown>[] {
  const path = join(process.cwd(), "fixtures", "tronx-demo-kitchen-menu.xlsx");
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run: npm run demo:workbook`);
  }
  const buffer = readFileSync(path);
  const book = XLSX.read(buffer, { type: "buffer" });
  const sheet = book.Sheets.Menu;
  if (!sheet) throw new Error("Menu sheet missing in workbook");
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
}

export async function seedCheeseRestaurant() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Refusing to seed in production without ALLOW_PRODUCTION_SEED=true");
  }

  await connectToDatabase();
  const now = new Date().toISOString();
  const {
    restaurantId: RESTAURANT_ID,
    slug: SLUG,
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
  } = CHEESE_DEMO;

  const featureOverrides = allFeatureOverridesOn();

  await upsertById(RestaurantModel, RESTAURANT_ID, {
    name: "Cheese",
    slug: SLUG,
    tagline: "Enterprise demo — every feature on",
    description:
      "Full ENTERPRISE demo outlet for verifying admin, captain, AI, inventory, CRM, offers, and POS.",
    address: "12 Demo Lane, Hyderabad",
    phone: "+91 90000 00012",
    isOpen: true,
    isActive: true,
    currency: "INR",
    subscriptionPlan: "ENTERPRISE",
    subscriptionEnabled: true,
    featureOverrides,
    orderSettings: {
      customerOrderingMode: "AUTOMATIC",
      internalTrackingEnabled: true,
    },
    loyaltySettings: {
      enabled: true,
      pointsPerCurrencyUnit: 1,
      currencyPerPoint: 1,
    },
    theme: {
      primaryColor: "#b45309",
      secondaryColor: "#78350f",
      accentColor: "#fbbf24",
      backgroundColor: "#fffbeb",
      textColor: "#1c1917",
      buttonStyle: "filled",
      borderRadius: "rounded",
    },
    billing: {
      taxRatePercent: 5,
      taxLabel: "GST",
      gstEnabled: true,
      gstRatePercent: 5,
      currency: "INR",
      priceMode: "EXCLUSIVE",
    },
    wifi: {
      ssid: "Cheese-Guest",
      security: "OPEN",
    },
    updatedAt: now,
    createdAt: now,
  });

  const rows = loadMenuRows();
  const categoryNames = [
    ...new Set(rows.map((row) => String(row.Category || "").trim()).filter(Boolean)),
  ];
  const categoryIds = new Map<string, string>();

  for (const [index, name] of categoryNames.entries()) {
    const id = `cheese-cat-${index + 1}`;
    categoryIds.set(name, id);
    await upsertById(CategoryModel, id, {
      restaurantId: RESTAURANT_ID,
      name,
      sortOrder: index + 1,
      isActive: true,
      updatedAt: now,
      createdAt: now,
    });
  }

  let dishCount = 0;
  const dishIds: string[] = [];
  for (const [index, row] of rows.entries()) {
    const name = String(row["Item Name"] || "").trim();
    const category = String(row.Category || "").trim();
    if (!name || !category) continue;
    const categoryId = categoryIds.get(category);
    if (!categoryId) continue;

    const asMoney = (value: unknown): number | null => {
      if (value === "" || value == null) return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    };
    const half = asMoney(row.Half);
    const full = asMoney(row.Full);
    const priceRaw = asMoney(row.Price);
    const variants =
      half != null || full != null
        ? [
            ...(half != null
              ? [{ id: `cheese-v-${index}-h`, name: "Half", price: half, isAvailable: true }]
              : []),
            ...(full != null
              ? [{ id: `cheese-v-${index}-f`, name: "Full", price: full, isAvailable: true }]
              : []),
          ]
        : [];
    const price = variants.length
      ? (variants.find((v) => v.name === "Full")?.price ?? variants[0]!.price)
      : (priceRaw ?? 0);

    const dietary = String(row.Dietary || "VEG").toUpperCase();
    const id = `cheese-dish-${index + 1}`;
    dishIds.push(id);
    await upsertById(DishModel, id, {
      restaurantId: RESTAURANT_ID,
      categoryId,
      name,
      description: String(row.Description || ""),
      price,
      type: dietary === "NON_VEG" ? "NON_VEG" : "VEG",
      isVeg: dietary !== "NON_VEG",
      isAvailable: String(row.Available || "YES").toUpperCase() !== "NO",
      sortOrder: Number(row["Sort Order"]) || index + 1,
      sku: String(row.SKU || "") || undefined,
      preparationTime: Number(row["Preparation Time"]) || undefined,
      variants,
      updatedAt: now,
      createdAt: now,
    });
    dishCount += 1;
  }

  for (let n = 1; n <= 10; n += 1) {
    await upsertById(TableModel, `cheese-table-${n}`, {
      restaurantId: RESTAURANT_ID,
      locationType: "TABLE",
      tableNumber: n,
      label: `T${n}`,
      capacity: n <= 4 ? 2 : 4,
      isActive: true,
      status: "OPEN",
      updatedAt: now,
      createdAt: now,
    });
  }
  for (let n = 301; n <= 304; n += 1) {
    await upsertById(TableModel, `cheese-room-${n}`, {
      restaurantId: RESTAURANT_ID,
      locationType: "ROOM",
      tableNumber: n,
      label: `Room ${n}`,
      capacity: 2,
      isActive: true,
      status: "OPEN",
      updatedAt: now,
      createdAt: now,
    });
  }

  await restaurantAdminService.setCredentials(RESTAURANT_ID, {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });

  try {
    await captainService.create(RESTAURANT_ID, {
      name: CHEESE_DEMO.captainName,
      email: CHEESE_DEMO.captainEmail,
      password: CHEESE_DEMO.captainPassword,
      employeeCode: "CH001",
    });
  } catch (error) {
    if (!(error instanceof Error) || !/already exists/i.test(error.message)) throw error;
  }

  // Seasonal demo offer (Christmas 20% entire menu) — ignore if one already exists by name.
  try {
    const existing = await menuOfferService.list(RESTAURANT_ID);
    if (!existing.some((offer) => offer.name === "Cheese Christmas Demo")) {
      await menuOfferService.create(RESTAURANT_ID, {
        name: "Cheese Christmas Demo",
        description: "Demo festive offer — 20% off entire menu",
        percentOff: 20,
        scope: "ALL_MENU",
        isActive: true,
        presentation: {
          themePreset: "CHRISTMAS",
          bannerHeadline: "Festive 20% off at Cheese",
          bannerSubtext: "Enterprise demo offer — whole menu",
          badgeText: "20% OFF",
          applyTheme: true,
        },
      });
    }
  } catch {
    // Offer seed is best-effort; menu/admin still usable without it.
  }

  let sampleDevices = 0;
  try {
    const devices = await deviceService.registerSampleDevices({
      restaurantId: RESTAURANT_ID,
      outletId: RESTAURANT_ID,
    });
    sampleDevices = (devices.created?.length ?? 0) + (devices.existing?.length ?? 0);
  } catch {
    // Devices lab is optional for menu/POS verification.
  }

  invalidateRestaurantMenus();

  const featureProbe = {
    subscriptionPlan: "ENTERPRISE" as const,
    subscriptionEnabled: true,
    featureOverrides,
  };
  const off = ALL_FEATURE_KEYS.filter((key) => !hasRestaurantFeature(featureProbe, key));

  return {
    restaurantId: RESTAURANT_ID,
    slug: SLUG,
    name: "Cheese",
    menuUrl: `/menu/${SLUG}`,
    adminUrl: `/admin/${SLUG}`,
    captainLoginHint: {
      restaurant: SLUG,
      email: CHEESE_DEMO.captainEmail,
      password: CHEESE_DEMO.captainPassword,
    },
    categories: categoryNames.length,
    dishes: dishCount,
    tables: 10,
    rooms: 4,
    adminEmail: ADMIN_EMAIL,
    adminPassword: ADMIN_PASSWORD,
    featuresOn: ALL_FEATURE_KEYS.length - off.length,
    featuresOff: off,
    plan: "ENTERPRISE",
    sampleDevices,
  };
}
