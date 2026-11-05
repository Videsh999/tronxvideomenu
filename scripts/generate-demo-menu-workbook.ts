/**
 * Generates a realistic demo Excel workbook for TRONX Demo Kitchen.
 * Idempotent file write — overwrites fixtures/tronx-demo-kitchen-menu.xlsx only.
 *
 * Usage: npx tsx scripts/generate-demo-menu-workbook.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as XLSX from "xlsx";

const OUT = join(process.cwd(), "fixtures", "tronx-demo-kitchen-menu.xlsx");

type Row = Record<string, string | number>;

const categories = [
  "Starters",
  "Soups",
  "Biryani",
  "Curries",
  "Breads",
  "Rice & Combos",
  "Chinese",
  "Pizza & Burgers",
  "Shakes",
  "Beverages",
  "Desserts",
  "Soft Drinks",
];

const bases: Array<{
  category: string;
  name: string;
  description?: string;
  price?: number;
  half?: number;
  full?: number;
  dietary: "VEG" | "NON_VEG";
  sku?: string;
}> = [
  { category: "Starters", name: "Veg Spring Roll", description: "Crispy rolls with mixed vegetables", price: 149, dietary: "VEG", sku: "ST-001" },
  { category: "Starters", name: "Paneer Tikka", description: "Tandoor-grilled cottage cheese", half: 199, full: 329, dietary: "VEG", sku: "ST-002" },
  { category: "Starters", name: "Chicken Wings", description: "Spicy glazed wings", half: 219, full: 369, dietary: "NON_VEG", sku: "ST-003" },
  { category: "Starters", name: "Fish Fingers", description: "Crispy batter-fried fish", price: 289, dietary: "NON_VEG", sku: "ST-004" },
  { category: "Starters", name: "Gobi Manchurian", description: "Indo-Chinese cauliflower", price: 179, dietary: "VEG", sku: "ST-005" },
  { category: "Starters", name: "Chicken 65", description: "Deep-fried spicy chicken", price: 249, dietary: "NON_VEG", sku: "ST-006" },
  { category: "Starters", name: "Hara Bhara Kabab", description: "Spinach and green pea patties", price: 169, dietary: "VEG", sku: "ST-007" },
  { category: "Starters", name: "Prawn Tempura", description: "Light batter prawns", price: 349, dietary: "NON_VEG", sku: "ST-008" },
  { category: "Soups", name: "Tomato Soup", description: "Classic cream of tomato", price: 119, dietary: "VEG", sku: "SP-001" },
  { category: "Soups", name: "Sweet Corn Soup", price: 129, dietary: "VEG", sku: "SP-002" },
  { category: "Soups", name: "Hot & Sour Veg", price: 139, dietary: "VEG", sku: "SP-003" },
  { category: "Soups", name: "Chicken Clear Soup", price: 149, dietary: "NON_VEG", sku: "SP-004" },
  { category: "Soups", name: "Manchow Soup", price: 149, dietary: "VEG", sku: "SP-005" },
  { category: "Biryani", name: "Veg Biryani", description: "Fragrant basmati with vegetables", half: 180, full: 280, dietary: "VEG", sku: "BR-001" },
  { category: "Biryani", name: "Chicken Biryani", description: "Hyderabadi dum style", half: 220, full: 350, dietary: "NON_VEG", sku: "BR-002" },
  { category: "Biryani", name: "Mutton Biryani", half: 280, full: 420, dietary: "NON_VEG", sku: "BR-003" },
  { category: "Biryani", name: "Egg Biryani", half: 190, full: 290, dietary: "NON_VEG", sku: "BR-004" },
  { category: "Biryani", name: "Paneer Biryani", half: 200, full: 320, dietary: "VEG", sku: "BR-005" },
  { category: "Biryani", name: "Prawn Biryani", half: 300, full: 450, dietary: "NON_VEG", sku: "BR-006" },
  { category: "Curries", name: "Dal Tadka", description: "Yellow lentils tempered with ghee", price: 169, dietary: "VEG", sku: "CU-001" },
  { category: "Curries", name: "Paneer Butter Masala", half: 199, full: 329, dietary: "VEG", sku: "CU-002" },
  { category: "Curries", name: "Butter Chicken", half: 229, full: 369, dietary: "NON_VEG", sku: "CU-003" },
  { category: "Curries", name: "Palak Paneer", half: 189, full: 309, dietary: "VEG", sku: "CU-004" },
  { category: "Curries", name: "Kadai Chicken", half: 219, full: 349, dietary: "NON_VEG", sku: "CU-005" },
  { category: "Curries", name: "Chole Masala", price: 179, dietary: "VEG", sku: "CU-006" },
  { category: "Curries", name: "Mutton Rogan Josh", half: 269, full: 399, dietary: "NON_VEG", sku: "CU-007" },
  { category: "Breads", name: "Butter Naan", price: 49, dietary: "VEG", sku: "BD-001" },
  { category: "Breads", name: "Garlic Naan", price: 59, dietary: "VEG", sku: "BD-002" },
  { category: "Breads", name: "Tandoori Roti", price: 35, dietary: "VEG", sku: "BD-003" },
  { category: "Breads", name: "Laccha Paratha", price: 55, dietary: "VEG", sku: "BD-004" },
  { category: "Breads", name: "Cheese Naan", price: 79, dietary: "VEG", sku: "BD-005" },
  { category: "Rice & Combos", name: "Steam Rice", price: 99, dietary: "VEG", sku: "RC-001" },
  { category: "Rice & Combos", name: "Jeera Rice", price: 129, dietary: "VEG", sku: "RC-002" },
  { category: "Rice & Combos", name: "Veg Thali", description: "Dal, sabzi, rice, roti, salad", price: 249, dietary: "VEG", sku: "RC-003" },
  { category: "Rice & Combos", name: "Non-Veg Thali", description: "Chicken curry, rice, roti, salad", price: 339, dietary: "NON_VEG", sku: "RC-004" },
  { category: "Rice & Combos", name: "Sambar Annam", price: 149, dietary: "VEG", sku: "RC-005" },
  { category: "Chinese", name: "Veg Fried Rice", price: 169, dietary: "VEG", sku: "CH-001" },
  { category: "Chinese", name: "Chicken Fried Rice", price: 199, dietary: "NON_VEG", sku: "CH-002" },
  { category: "Chinese", name: "Veg Noodles", price: 169, dietary: "VEG", sku: "CH-003" },
  { category: "Chinese", name: "Chicken Noodles", price: 199, dietary: "NON_VEG", sku: "CH-004" },
  { category: "Chinese", name: "Chilli Paneer", price: 219, dietary: "VEG", sku: "CH-005" },
  { category: "Chinese", name: "Chilli Chicken", price: 249, dietary: "NON_VEG", sku: "CH-006" },
  { category: "Pizza & Burgers", name: "Margherita Pizza", half: 199, full: 349, dietary: "VEG", sku: "PZ-001" },
  { category: "Pizza & Burgers", name: "Farmhouse Pizza", half: 249, full: 429, dietary: "VEG", sku: "PZ-002" },
  { category: "Pizza & Burgers", name: "Chicken Tikka Pizza", half: 269, full: 459, dietary: "NON_VEG", sku: "PZ-003" },
  { category: "Pizza & Burgers", name: "Veg Burger", price: 129, dietary: "VEG", sku: "BG-001" },
  { category: "Pizza & Burgers", name: "Chicken Burger", price: 159, dietary: "NON_VEG", sku: "BG-002" },
  { category: "Shakes", name: "Chocolate Shake", price: 149, dietary: "VEG", sku: "SH-001" },
  { category: "Shakes", name: "Oreo Shake", price: 169, dietary: "VEG", sku: "SH-002" },
  { category: "Shakes", name: "Mango Shake", price: 139, dietary: "VEG", sku: "SH-003" },
  { category: "Shakes", name: "Strawberry Shake", price: 149, dietary: "VEG", sku: "SH-004" },
  { category: "Shakes", name: "Cold Coffee", price: 129, dietary: "VEG", sku: "SH-005" },
  { category: "Beverages", name: "Masala Chai", price: 39, dietary: "VEG", sku: "BV-001" },
  { category: "Beverages", name: "Filter Coffee", price: 49, dietary: "VEG", sku: "BV-002" },
  { category: "Beverages", name: "Fresh Lime Soda", price: 79, dietary: "VEG", sku: "BV-003" },
  { category: "Beverages", name: "Sweet Lassi", price: 89, dietary: "VEG", sku: "BV-004" },
  { category: "Beverages", name: "Buttermilk", price: 59, dietary: "VEG", sku: "BV-005" },
  { category: "Beverages", name: "Hot Chocolate", price: 109, dietary: "VEG", sku: "BV-006" },
  { category: "Soft Drinks", name: "Coca-Cola", price: 60, dietary: "VEG", sku: "SD-001" },
  { category: "Soft Drinks", name: "Sprite", price: 60, dietary: "VEG", sku: "SD-002" },
  { category: "Soft Drinks", name: "Thums Up", price: 60, dietary: "VEG", sku: "SD-003" },
  { category: "Soft Drinks", name: "Water Bottle", price: 20, dietary: "VEG", sku: "SD-004" },
  { category: "Desserts", name: "Gulab Jamun", description: "2 pieces", price: 79, dietary: "VEG", sku: "DS-001" },
  { category: "Desserts", name: "Ice Cream Scoop", price: 69, dietary: "VEG", sku: "DS-002" },
  { category: "Desserts", name: "Brownie", price: 129, dietary: "VEG", sku: "DS-003" },
  { category: "Desserts", name: "Rasmalai", price: 99, dietary: "VEG", sku: "DS-004" },
];

function expandToEighty(): typeof bases {
  const out = [...bases];
  let n = 1;
  while (out.length < 80) {
    const cat = categories[n % categories.length]!;
    out.push({
      category: cat,
      name: `Chef Special ${n}`,
      description: n % 3 === 0 ? "" : `Seasonal special number ${n}`,
      price: 99 + (n % 20) * 10,
      dietary: n % 4 === 0 ? "NON_VEG" : "VEG",
      sku: n % 5 === 0 ? "" : `CS-${String(n).padStart(3, "0")}`,
    });
    n += 1;
  }
  return out;
}

function toRow(item: (typeof bases)[number], index: number): Row {
  const hasHalfFull = item.half != null || item.full != null;
  return {
    Category: item.category,
    "Item Name": item.name,
    Description: item.description ?? "",
    Price: hasHalfFull ? "" : (item.price ?? ""),
    Half: item.half ?? "",
    Full: item.full ?? "",
    Dietary: item.dietary,
    SKU: item.sku ?? "",
    Available: "YES",
    "Preparation Time": 10 + (index % 20),
    "Sort Order": index + 1,
    "Add-ons": index % 11 === 0 ? "Extras[Cheese:20|Butter:15]" : "",
  };
}

function main() {
  const items = expandToEighty();
  const rows = items.map(toRow);
  const book = XLSX.utils.book_new();
  const menuSheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(book, menuSheet, "Menu");

  const negative = XLSX.utils.aoa_to_sheet([
    ["Category", "Item Name", "Description", "Price", "Half", "Full", "Dietary", "SKU"],
    ["", "Missing Category", "Should fail", 100, "", "", "VEG", "BAD-001"],
    ["Starters", "", "Missing name", 100, "", "", "VEG", "BAD-002"],
    ["Starters", "Bad Price", "", "abc", "", "", "VEG", "BAD-003"],
    ["Starters", "Negative Price", "", -10, "", "", "VEG", "BAD-004"],
  ]);
  XLSX.utils.book_append_sheet(book, negative, "Negative-Tests");

  mkdirSync(dirname(OUT), { recursive: true });
  const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  writeFileSync(OUT, buffer);
  console.log(JSON.stringify({ path: OUT, menuRows: rows.length, categories: categories.length }, null, 2));
}

main();
