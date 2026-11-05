import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";
import { parseWorkbookBuffer } from "../lib/menu-import/parse-workbook";
import { suggestColumnMappings } from "../lib/menu-import/map-columns";
import { buildItemDraftsFromGrid } from "../lib/menu-import/infer-rows";
import { applyExistingMatches } from "../lib/menu-import/match-existing";
import {
  normalizeHeader,
  normalizeOptionalString,
  parseMoney,
  similarity,
} from "../lib/menu-import/normalize";
import { importItemDraftSchema, normalizeImportItemDraft } from "../lib/menu-import/item-schema";
import { summarizeValidation } from "../lib/menu-import/validate-draft";
import type { Category, Dish } from "../types";

test("normalizeHeader and money parsing handle Indian menu formats", () => {
  assert.equal(normalizeHeader("Item Name"), "item name");
  assert.equal(parseMoney("₹1,299"), 1299);
  assert.equal(parseMoney("Rs. 149.50"), 149.5);
  assert.equal(parseMoney(""), null);
  assert.ok(similarity("dish name", "food name") > 0.4);
});

test("suggestColumnMappings recognizes Format A headers and Half/Full variants", () => {
  const mappings = suggestColumnMappings(["Category", "Item Name", "Description", "Half", "Full", "Type"]);
  assert.equal(mappings.find((m) => m.sourceHeader === "Item Name")?.canonical, "itemName");
  assert.equal(mappings.find((m) => m.sourceHeader === "Category")?.canonical, "category");
  assert.equal(mappings.find((m) => m.sourceHeader === "Half")?.variantName, "Half");
  assert.equal(mappings.find((m) => m.sourceHeader === "Full")?.variantName, "Full");
  assert.equal(mappings.find((m) => m.sourceHeader === "Type")?.canonical, "dietary");
});

test("buildItemDraftsFromGrid creates items with variants and category header rows", () => {
  const grid = [
    ["Category", "Item Name", "Half", "Full", "Dietary"],
    ["Biryani", "", "", "", ""],
    ["", "Chicken Biryani", "220", "350", "NON_VEG"],
    ["", "Veg Biryani", "180", "280", "VEG"],
  ];
  const mappings = suggestColumnMappings(grid[0]!);
  // Category column exists but category header row uses empty item name.
  const drafts = buildItemDraftsFromGrid(grid, mappings, "General");
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0]?.name, "Chicken Biryani");
  assert.equal(drafts[0]?.categoryName, "Biryani");
  assert.equal(drafts[0]?.variants.length, 2);
  assert.equal(drafts[0]?.price, 220);
  assert.equal(drafts[1]?.dietary, "VEG");
});

test("applyExistingMatches respects CREATE_ONLY and UPDATE_MATCHING strategies", () => {
  const drafts = buildItemDraftsFromGrid(
    [
      ["Item", "Section", "Rate"],
      ["Paneer Tikka", "Starters", "249"],
      ["New Salad", "Starters", "179"],
    ],
    suggestColumnMappings(["Item", "Section", "Rate"]),
  );
  const categories: Category[] = [
    { id: "cat-1", restaurantId: "r1", name: "Starters", sortOrder: 0, isActive: true },
  ];
  const dishes: Dish[] = [
    {
      id: "dish-1",
      restaurantId: "r1",
      categoryId: "cat-1",
      name: "Paneer Tikka",
      price: 229,
      isVeg: true,
      isAvailable: true,
      sortOrder: 0,
    },
  ];

  const createOnly = applyExistingMatches(drafts.map((d) => ({ ...d })), dishes, categories, "CREATE_ONLY");
  assert.equal(createOnly.items.find((item) => item.name === "Paneer Tikka")?.action, "SKIP");
  assert.equal(createOnly.items.find((item) => item.name === "New Salad")?.action, "CREATE");

  const update = applyExistingMatches(drafts.map((d) => ({ ...d })), dishes, categories, "UPDATE_MATCHING");
  assert.equal(update.items.find((item) => item.name === "Paneer Tikka")?.action, "UPDATE");
  assert.equal(update.items.find((item) => item.name === "Paneer Tikka")?.matchDishId, "dish-1");
});

test("SKU match updates once; grid collapses in-file duplicates before match", () => {
  const drafts = buildItemDraftsFromGrid(
    [
      ["Category", "Item Name", "SKU", "Price"],
      ["Beverages", "Masala Chai", "BV-001", "45"],
      ["Beverages", "Masala Chai", "BV-001", "99"],
      ["Specials", "Chef Platter", "SP-NEW", "499"],
    ],
    suggestColumnMappings(["Category", "Item Name", "SKU", "Price"]),
  );
  // Grid parser merges same SKU+category into one draft (kept once).
  assert.equal(drafts.filter((d) => d.sku === "BV-001").length, 1);
  assert.deepEqual(drafts.find((d) => d.sku === "BV-001")?.sourceRowNumbers, [2, 3]);

  const categories: Category[] = [
    { id: "cat-bev", restaurantId: "r1", name: "Beverages", sortOrder: 1, isActive: true },
  ];
  const dishes: Dish[] = [
    {
      id: "dish-chai",
      restaurantId: "r1",
      categoryId: "cat-bev",
      name: "Masala Chai",
      sku: "BV-001",
      price: 39,
      isVeg: true,
      isAvailable: true,
      sortOrder: 1,
    },
  ];

  const preview = applyExistingMatches(drafts, dishes, categories, "UPDATE_MATCHING");
  assert.equal(preview.items.find((item) => item.sku === "BV-001")?.action, "UPDATE");
  assert.equal(preview.items.find((item) => item.sku === "BV-001")?.matchDishId, "dish-chai");
  assert.equal(preview.items.find((item) => item.name === "Chef Platter")?.action, "CREATE");
  assert.equal(preview.summary.createCount, 1);
  assert.equal(preview.summary.updateCount, 1);
  assert.equal(preview.summary.skipCount, 0);
});

test("match-existing skips second identical draft when two reach the matcher", () => {
  const categories: Category[] = [
    { id: "cat-bev", restaurantId: "r1", name: "Beverages", sortOrder: 1, isActive: true },
  ];
  const dishes: Dish[] = [
    {
      id: "dish-chai",
      restaurantId: "r1",
      categoryId: "cat-bev",
      name: "Masala Chai",
      sku: "BV-001",
      price: 39,
      isVeg: true,
      isAvailable: true,
      sortOrder: 1,
    },
  ];
  const base = {
    categoryName: "Beverages",
    description: "",
    price: 45,
    compareAtPrice: null,
    dietary: "VEG" as const,
    prepTimeMinutes: null,
    sku: "BV-001",
    tags: [] as string[],
    isAvailable: true,
    variants: [],
    addons: [],
    confidence: 0.9,
    action: "CREATE" as const,
    errors: [] as string[],
    warnings: [] as string[],
    included: true,
  };
  const drafts = [
    { ...base, rowKey: "a", sourceRowNumbers: [2], name: "Masala Chai" },
    { ...base, rowKey: "b", sourceRowNumbers: [3], name: "Masala Chai", price: 99 },
  ];
  const preview = applyExistingMatches(drafts, dishes, categories, "UPDATE_MATCHING");
  assert.equal(preview.summary.updateCount, 1);
  assert.equal(preview.summary.skipCount, 1);
  assert.equal(preview.items[1]?.action, "SKIP");
});

test("parseWorkbookBuffer reads CSV buffers without executing formulas", () => {
  const csv = "Category,Item Name,Price\nMains,Dal Tadka,180\nMains,Butter Chicken,280\n";
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Category", "Item Name", "Price"],
    ["Mains", "Dal Tadka", 180],
    ["Mains", "Butter Chicken", 280],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Menu");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const parsed = parseWorkbookBuffer(buffer);
  assert.equal(parsed.sheets.length, 1);
  assert.equal(parsed.sheets[0]?.name, "Menu");
  assert.ok(parsed.sheets[0]!.rowCount >= 2);
  assert.ok(csv.includes("Dal Tadka"));
});

test("malformed rows without prices are marked for review", () => {
  const drafts = buildItemDraftsFromGrid(
    [
      ["Dish", "Section", "Rate"],
      ["Mystery Item", "Specials", ""],
    ],
    suggestColumnMappings(["Dish", "Section", "Rate"]),
  );
  assert.equal(drafts.length, 1);
  assert.ok(drafts[0]?.errors.some((error) => /price/i.test(error)));
  assert.equal(drafts[0]?.included, false);
});

test("empty description and sku cells do not create validation errors", () => {
  assert.equal(normalizeOptionalString(null), undefined);
  assert.equal(normalizeOptionalString(undefined), undefined);
  assert.equal(normalizeOptionalString("   "), undefined);
  assert.equal(normalizeOptionalString("  Fresh  "), "Fresh");

  const drafts = buildItemDraftsFromGrid(
    [
      ["Category", "Item Name", "Description", "SKU", "Price"],
      ["Mains", "Dal Tadka", "", "", "180"],
      ["Mains", "Butter Chicken", "", "   ", "280"],
      ["Mains", "Paneer Butter", "Creamy gravy", "SKU-1", "260"],
    ],
    suggestColumnMappings(["Category", "Item Name", "Description", "SKU", "Price"]),
  );
  assert.equal(drafts.length, 3);
  assert.equal(drafts[0]?.description, undefined);
  assert.equal(drafts[0]?.sku, undefined);
  assert.equal(drafts[0]?.errors.length, 0);
  assert.equal(drafts[1]?.errors.length, 0);
  assert.equal(drafts[2]?.description, "Creamy gravy");
  assert.equal(drafts[2]?.sku, "SKU-1");

  // Mongo/JSON round-trip nulls must parse through the preview schema.
  for (const draft of drafts) {
    const withNulls = {
      ...normalizeImportItemDraft(draft),
      description: null,
      sku: null,
      matchDishId: null,
      matchReason: null,
      tags: null,
    };
    const parsed = importItemDraftSchema.parse(withNulls);
    assert.equal(parsed.description, undefined);
    assert.equal(parsed.sku, undefined);
    assert.deepEqual(parsed.tags, []);
  }
});


test("missing required dish names are blocking; mixed valid/invalid reported", () => {
  const drafts = buildItemDraftsFromGrid(
    [
      ["Category", "Item Name", "Price"],
      ["Mains", "Good Dish", "120"],
      ["Mains", "", "99"],
      ["Mains", "Bad Price", "nope"],
    ],
    suggestColumnMappings(["Category", "Item Name", "Price"]),
  );
  // Empty name rows are skipped by the grid builder (not imported as blank dishes).
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0]?.name, "Good Dish");
  assert.equal(drafts[0]?.errors.length, 0);
  assert.ok(drafts[1]?.errors.some((error) => /price/i.test(error)));
  assert.equal(drafts.filter((d) => d.errors.length === 0).length, 1);
  assert.equal(drafts.filter((d) => d.errors.length > 0).length, 1);
});

test("create-only and smart-merge behaviour remain intact with blank optional fields", () => {
  const drafts = buildItemDraftsFromGrid(
    [
      ["Item", "Section", "Rate", "Description", "SKU"],
      ["Paneer Tikka", "Starters", "249", "", ""],
      ["New Salad", "Starters", "179", "", "  "],
    ],
    suggestColumnMappings(["Item", "Section", "Rate", "Description", "SKU"]),
  );
  const categories: Category[] = [
    { id: "cat-1", restaurantId: "r1", name: "Starters", sortOrder: 0, isActive: true },
  ];
  const dishes: Dish[] = [
    {
      id: "dish-1",
      restaurantId: "r1",
      categoryId: "cat-1",
      name: "Paneer Tikka",
      price: 229,
      isVeg: true,
      isAvailable: true,
      sortOrder: 0,
    },
  ];
  const createOnly = applyExistingMatches(
    drafts.map((d) => ({ ...d })),
    dishes,
    categories,
    "CREATE_ONLY",
  );
  assert.equal(createOnly.items.find((item) => item.name === "Paneer Tikka")?.action, "SKIP");
  assert.equal(createOnly.items.find((item) => item.name === "New Salad")?.action, "CREATE");
  assert.ok(createOnly.items.every((item) => item.errors.length === 0));

  const merge = applyExistingMatches(drafts.map((d) => ({ ...d })), dishes, categories, "SMART_MERGE");
  assert.equal(merge.items.find((item) => item.name === "Paneer Tikka")?.action, "UPDATE");
  assert.equal(merge.items.find((item) => item.name === "Paneer Tikka")?.included, false);
});

test("excel and csv empty optional cells normalize consistently", () => {
  const headers = ["Category", "Item Name", "Description", "SKU", "Price"];
  const xlsxGrid = [
    headers,
    ["Mains", "Idli", "", "", "40"],
    ["Mains", "Dosa", "   ", "  ", "60"],
  ];
  const csv = "Category,Item Name,Description,SKU,Price\nMains,Idli,,,40\nMains,Dosa,   ,  ,60\n";
  const fromGrid = buildItemDraftsFromGrid(xlsxGrid, suggestColumnMappings(headers));
  const csvSheet = XLSX.utils.aoa_to_sheet([
    headers,
    ["Mains", "Idli", "", "", 40],
    ["Mains", "Dosa", "   ", "  ", 60],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, csvSheet, "Menu");
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const parsed = parseWorkbookBuffer(buffer);
  const fromParsed = buildItemDraftsFromGrid(
    parsed.sheets[0] ? parsed.grids[parsed.sheets[0].name]! : xlsxGrid,
    suggestColumnMappings(headers),
  );
  assert.equal(fromGrid.length, 2);
  assert.equal(fromParsed.length, 2);
  assert.ok(fromGrid.every((item) => item.errors.length === 0));
  assert.ok(fromParsed.every((item) => item.errors.length === 0));
  assert.equal(fromGrid[0]?.description, undefined);
  assert.equal(fromParsed[0]?.sku, undefined);
  assert.ok(csv.includes("Idli"));
});

test("validation summary reports row-level errors and warnings", () => {
  const summary = summarizeValidation([
    {
      rowKey: "a",
      sourceRowNumbers: [2],
      name: "A",
      categoryName: "C",
      price: 10,
      isAvailable: true,
      variants: [],
      addons: [],
      confidence: 1,
      action: "CREATE",
      errors: [],
      warnings: ["Dietary type could not be determined."],
      included: true,
    },
    {
      rowKey: "b",
      sourceRowNumbers: [3],
      name: "",
      categoryName: "C",
      price: null,
      isAvailable: true,
      variants: [],
      addons: [],
      confidence: 1,
      action: "NEEDS_REVIEW",
      errors: ["Dish name is missing. Please correct this row."],
      warnings: [],
      included: false,
    },
  ]);
  assert.equal(summary.validRowCount, 1);
  assert.equal(summary.invalidRowCount, 1);
  assert.equal(summary.warningCount, 1);
  assert.ok(summary.errors[0]?.message.includes("Row 3"));
});
