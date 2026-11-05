import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { connectToDatabase } from "@/lib/db/mongodb";
import { CategoryModel, DishModel, RestaurantModel, TableModel } from "@/lib/db/models";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";

export const DEMO_KITCHEN = {
  restaurantId: "tronx-demo-kitchen",
  slug: "tronx-demo-kitchen",
  adminEmail: "demo@tronx.local",
  adminPassword: "DemoKitchen!2026",
} as const;

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

export async function seedTronxDemoKitchen() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    throw new Error("Refusing to seed in production without ALLOW_PRODUCTION_SEED=true");
  }

  await connectToDatabase();
  const now = new Date().toISOString();
  const { restaurantId: RESTAURANT_ID, slug: SLUG, adminEmail: ADMIN_EMAIL, adminPassword: ADMIN_PASSWORD } =
    DEMO_KITCHEN;

  await upsertById(RestaurantModel, RESTAURANT_ID, {
    name: "TRONX Demo Kitchen",
    slug: SLUG,
    tagline: "Audit & demo outlet — synthetic data only",
    description: "Isolated demo restaurant for TRONX production-readiness testing.",
    isOpen: true,
    isActive: true,
    currency: "INR",
    subscriptionPlan: "ENTERPRISE",
    subscriptionEnabled: true,
    theme: {
      primaryColor: "#2f241c",
      secondaryColor: "#5c4634",
      accentColor: "#e7c27d",
      backgroundColor: "#ffffff",
      textColor: "#241416",
      buttonStyle: "filled",
      borderRadius: "rounded",
    },
    billing: { taxRatePercent: 5, taxLabel: "GST" },
    updatedAt: now,
    createdAt: now,
  });

  const rows = loadMenuRows();
  const categoryNames = [...new Set(rows.map((row) => String(row.Category || "").trim()).filter(Boolean))];
  const categoryIds = new Map<string, string>();

  for (const [index, name] of categoryNames.entries()) {
    const id = `tdk-cat-${index + 1}`;
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
  for (const [index, row] of rows.entries()) {
    const name = String(row["Item Name"] || "").trim();
    const category = String(row.Category || "").trim();
    if (!name || !category) continue;
    const categoryId = categoryIds.get(category);
    if (!categoryId) continue;

    // Empty Excel cells become "" — Number("") is 0, so treat blanks as missing.
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
            ...(half != null ? [{ id: `tdk-v-${index}-h`, name: "Half", price: half, isAvailable: true }] : []),
            ...(full != null ? [{ id: `tdk-v-${index}-f`, name: "Full", price: full, isAvailable: true }] : []),
          ]
        : [];
    const price = variants.length
      ? (variants.find((v) => v.name === "Full")?.price ?? variants[0]!.price)
      : (priceRaw ?? 0);

    const dietary = String(row.Dietary || "VEG").toUpperCase();
    const id = `tdk-dish-${index + 1}`;
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
      // Always set variants (including []) so re-seed clears bad Half/Full leftovers.
      variants,
      updatedAt: now,
      createdAt: now,
    });
    dishCount += 1;
  }

  for (let n = 1; n <= 8; n += 1) {
    await upsertById(TableModel, `tdk-table-${n}`, {
      restaurantId: RESTAURANT_ID,
      tableNumber: n,
      label: `Demo ${n}`,
      capacity: n <= 4 ? 2 : 4,
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

  return {
    restaurantId: RESTAURANT_ID,
    slug: SLUG,
    menuUrl: `/menu/${SLUG}`,
    adminUrl: `/admin/${SLUG}`,
    categories: categoryNames.length,
    dishes: dishCount,
    adminEmail: ADMIN_EMAIL,
  };
}
