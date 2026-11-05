import * as XLSX from "xlsx";
import type { AddonGroup, Category, Dish } from "@/types";

export const MENU_EXPORT_HEADERS = [
  "Category",
  "Item Name",
  "Description",
  "Price",
  "Half",
  "Full",
  "Dietary",
  "SKU",
  "Available",
  "Preparation Time",
  "Sort Order",
  "Add-ons",
] as const;

export type MenuExportRow = Record<(typeof MENU_EXPORT_HEADERS)[number], string | number>;

function variantPrice(dish: Dish, needle: RegExp): number | "" {
  const match = (dish.variants ?? []).find((variant) => needle.test(variant.name));
  return match ? match.price : "";
}

function addonSummary(dish: Dish, addonGroups: AddonGroup[]): string {
  const ids = new Set(dish.addonGroupIds ?? []);
  if (ids.size === 0) return "";
  return addonGroups
    .filter((group) => ids.has(group.id) && group.isActive !== false)
    .map((group) => {
      const items = (group.addons ?? [])
        .filter((addon) => addon.isAvailable !== false)
        .map((addon) => `${addon.name}:${addon.price}`)
        .join("|");
      return items ? `${group.name}[${items}]` : group.name;
    })
    .join("; ");
}

/** Guard against CSV/Excel formula injection when cells start with = + - @ */
export function sanitizeExportCell(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  const text = String(value);
  if (/^[=+\-@]/.test(text)) return `'${text}`;
  return text;
}

export function buildMenuExportRows(
  categories: Category[],
  dishes: Dish[],
  addonGroups: AddonGroup[] = [],
): MenuExportRow[] {
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const sorted = [...dishes].sort((a, b) => {
    const catA = categoryName.get(a.categoryId) ?? "";
    const catB = categoryName.get(b.categoryId) ?? "";
    if (catA !== catB) return catA.localeCompare(catB);
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name);
  });

  return sorted.map((dish) => {
    const half = variantPrice(dish, /half/i);
    const full = variantPrice(dish, /full/i);
    const hasHalfFull = half !== "" || full !== "";
    return {
      Category: sanitizeExportCell(categoryName.get(dish.categoryId) ?? "") as string,
      "Item Name": sanitizeExportCell(dish.name) as string,
      Description: sanitizeExportCell(dish.description ?? "") as string,
      Price: hasHalfFull ? "" : (Number.isFinite(dish.price) ? dish.price : ""),
      Half: half,
      Full: full,
      Dietary: dish.type === "NON_VEG" ? "NON_VEG" : "VEG",
      SKU: sanitizeExportCell(dish.sku ?? "") as string,
      Available: dish.isAvailable === false ? "NO" : "YES",
      "Preparation Time": dish.preparationTime ?? "",
      "Sort Order": dish.sortOrder ?? "",
      "Add-ons": sanitizeExportCell(addonSummary(dish, addonGroups)) as string,
    };
  });
}

export function buildMenuExportWorkbook(
  categories: Category[],
  dishes: Dish[],
  addonGroups: AddonGroup[] = [],
): XLSX.WorkBook {
  const rows = buildMenuExportRows(categories, dishes, addonGroups);
  const sheet = XLSX.utils.json_to_sheet(rows, { header: [...MENU_EXPORT_HEADERS] });
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Menu");

  const categorySheet = XLSX.utils.json_to_sheet(
    [...categories]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
      .map((category) => ({
        Name: sanitizeExportCell(category.name),
        Description: sanitizeExportCell(category.description ?? ""),
        Active: category.isActive === false ? "NO" : "YES",
        "Sort Order": category.sortOrder ?? "",
      })),
  );
  XLSX.utils.book_append_sheet(book, categorySheet, "Categories");
  return book;
}

export function writeMenuExportBuffer(
  categories: Category[],
  dishes: Dish[],
  addonGroups: AddonGroup[] = [],
  format: "xlsx" | "csv" = "xlsx",
): Buffer {
  const book = buildMenuExportWorkbook(categories, dishes, addonGroups);
  if (format === "csv") {
    const csv = XLSX.utils.sheet_to_csv(book.Sheets.Menu!);
    return Buffer.from(csv, "utf8");
  }
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
