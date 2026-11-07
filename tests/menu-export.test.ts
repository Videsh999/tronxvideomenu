import assert from "node:assert/strict";
import test from "node:test";
import {
  buildMenuExportRows,
  sanitizeExportCell,
  writeMenuExportBuffer,
} from "../lib/menu-export/build-workbook";
import { readXlsxSheets } from "../lib/spreadsheet";
import type { AddonGroup, Category, Dish } from "../types";

const categories: Category[] = [
  {
    id: "cat-bev",
    restaurantId: "r1",
    name: "Beverages",
    sortOrder: 1,
    isActive: true,
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "cat-main",
    restaurantId: "r1",
    name: "Mains",
    sortOrder: 2,
    isActive: true,
    createdAt: "",
    updatedAt: "",
  },
];

const addonGroups: AddonGroup[] = [
  {
    id: "ag-1",
    restaurantId: "r1",
    name: "Extras",
    isRequired: false,
    minSelect: 0,
    maxSelect: 3,
    isActive: true,
    addons: [
      { id: "a1", addonGroupId: "ag-1", name: "Cheese", price: 20, isAvailable: true },
      { id: "a2", addonGroupId: "ag-1", name: "Butter", price: 15, isAvailable: true },
    ],
    createdAt: "",
    updatedAt: "",
  },
];

const dishes: Dish[] = [
  {
    id: "d1",
    restaurantId: "r1",
    categoryId: "cat-bev",
    name: "Chai",
    description: "",
    price: 30,
    type: "VEG",
    isVeg: true,
    isAvailable: true,
    sortOrder: 1,
    sku: "BV-001",
    createdAt: "",
    updatedAt: "",
  },
  {
    id: "d2",
    restaurantId: "r1",
    categoryId: "cat-main",
    name: "=SUM(A1)",
    description: "Formula injection probe",
    price: 180,
    type: "VEG",
    isVeg: true,
    isAvailable: true,
    sortOrder: 1,
    variants: [
      { id: "v1", name: "Half", price: 120 },
      { id: "v2", name: "Full", price: 180 },
    ],
    addonGroupIds: ["ag-1"],
    createdAt: "",
    updatedAt: "",
  },
];

test("sanitizeExportCell neutralizes formula-like prefixes", () => {
  assert.equal(sanitizeExportCell("=CMD()"), "'=CMD()");
  assert.equal(sanitizeExportCell("+1234"), "'+1234");
  assert.equal(sanitizeExportCell("Chai"), "Chai");
  assert.equal(sanitizeExportCell(30), 30);
});

test("menu export rows include prices, half/full, and add-ons", () => {
  const rows = buildMenuExportRows(categories, dishes, addonGroups);
  assert.equal(rows.length, 2);
  const chai = rows.find((row) => row["Item Name"] === "Chai");
  assert.ok(chai);
  assert.equal(chai!.Price, 30);
  assert.equal(chai!.SKU, "BV-001");
  assert.equal(chai!.Category, "Beverages");

  const injected = rows.find((row) => String(row["Item Name"]).includes("SUM"));
  assert.ok(injected);
  assert.equal(injected!["Item Name"], "'=SUM(A1)");
  assert.equal(injected!.Half, 120);
  assert.equal(injected!.Full, 180);
  assert.equal(injected!.Price, "");
  assert.match(String(injected!["Add-ons"]), /Cheese:20/);
});

test("xlsx workbook round-trips through the spreadsheet reader", async () => {
  const buffer = await writeMenuExportBuffer(categories, dishes, addonGroups, "xlsx");
  assert.ok(buffer.byteLength > 100);
  const sheets = await readXlsxSheets(buffer);
  assert.ok(sheets.some((sheet) => sheet.name === "Menu"));
  assert.ok(sheets.some((sheet) => sheet.name === "Categories"));
  const menu = sheets.find((sheet) => sheet.name === "Menu");
  const names = (menu?.rows ?? []).map((row) => row[1]);
  assert.ok(names.includes("Chai") || names.includes("'=SUM(A1)"));
});

test("csv export is utf-8 text with headers", async () => {
  const buffer = await writeMenuExportBuffer(categories, dishes, addonGroups, "csv");
  const text = buffer.toString("utf8");
  assert.match(text, /Category,Item Name/);
  assert.match(text, /Chai/);
  assert.match(text, /Beverages/);
});
