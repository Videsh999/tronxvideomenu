import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readXlsxSheets } from "@/lib/spreadsheet";
import { connectToDatabase } from "@/lib/db/mongodb";
import { CategoryModel, DishModel, RestaurantModel, TableModel } from "@/lib/db/models";
import { restaurantAdminService } from "@/lib/services/restaurant-admin.service";

export const DEMO_KITCHEN = {
  restaurantId: "tronx-demo-kitchen",
  slug: "tronx-demo-kitchen",
  adminEmail: "demo@tronx.local",
} as const;

function isLoopbackMongoUri(uri: string): boolean {
  if (!uri.startsWith("mongodb://")) return false;
  const withoutScheme = uri.slice("mongodb://".length);
  const hostPart = (withoutScheme.split("@").pop() ?? "").split("/")[0] ?? "";
  if (!hostPart) return false;
  return hostPart.split(",").every((entry) => {
    const host = entry.trim().replace(/^\[|\]$/g, "").split(":")[0];
    return host === "localhost" || host === "127.0.0.1";
  });
}

/**
 * Fail closed. Production is never allowed. A loopback URI, an explicit
 * confirm flag, and a password from the environment are all required.
 * The password is returned to the caller and must not be logged.
 */
export function assertSafeDemoSeed(): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed in production.");
  }
  if (process.env.TRONX_DEMO_SEED_CONFIRM !== "localhost") {
    throw new Error("Refusing to seed without TRONX_DEMO_SEED_CONFIRM=localhost.");
  }
  if (!isLoopbackMongoUri(process.env.MONGODB_URI ?? "")) {
    throw new Error("Refusing to seed unless MONGODB_URI is a loopback MongoDB.");
  }
  const password = process.env.TRONX_DEMO_ADMIN_PASSWORD ?? "";
  if (password.length < 12) {
    throw new Error("TRONX_DEMO_ADMIN_PASSWORD is required and must be at least 12 characters.");
  }
  return password;
}

async function upsertById(
  model: { updateOne: (f: object, u: object, o?: object) => Promise<unknown> },
  id: string,
  doc: Record<string, unknown>,
) {
  await model.updateOne({ id }, { $set: { ...doc, id } }, { upsert: true });
}

async function loadMenuRows(): Promise<Record<string, unknown>[]> {
  const path = join(process.cwd(), "fixtures", "tronx-demo-kitchen-menu.xlsx");
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run: npm run demo:workbook`);
  }
  const sheets = await readXlsxSheets(readFileSync(path));
  const sheet = sheets.find((entry) => entry.name === "Menu");
  if (!sheet) throw new Error("Menu sheet missing in workbook");
  const [header, ...body] = sheet.rows;
  if (!header) throw new Error("Menu sheet missing in workbook");
  return body.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ""])));
}

export async function seedTronxDemoKitchen() {
  const adminPassword = assertSafeDemoSeed();

  await connectToDatabase();
  const now = new Date().toISOString();
  const { restaurantId: RESTAURANT_ID, slug: SLUG, adminEmail: ADMIN_EMAIL } = DEMO_KITCHEN;

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

  const rows = await loadMenuRows();
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
    password: adminPassword,
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
