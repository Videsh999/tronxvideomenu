/**
 * Second Excel for re-upload / merge testing.
 * Contains overlapping items (should UPDATE once) + brand-new items (CREATE).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as XLSX from "xlsx";

const OUT = join(process.cwd(), "fixtures", "tronx-demo-kitchen-reupload.xlsx");

const rows = [
  // Overlaps with primary workbook — should match & update, not duplicate
  {
    Category: "Starters",
    "Item Name": "Veg Spring Roll",
    Description: "Updated crispy rolls — reupload test",
    Price: 159,
    Half: "",
    Full: "",
    Dietary: "VEG",
    SKU: "ST-001",
  },
  {
    Category: "Biryani",
    "Item Name": "Chicken Biryani",
    Description: "Updated dum biryani — reupload test",
    Price: "",
    Half: 240,
    Full: 370,
    Dietary: "NON_VEG",
    SKU: "BR-002",
  },
  {
    Category: "Beverages",
    "Item Name": "Masala Chai",
    Description: "Spiced tea — price bump",
    Price: 45,
    Half: "",
    Full: "",
    Dietary: "VEG",
    SKU: "BV-001",
  },
  // Duplicate inside this file — second row must SKIP
  {
    Category: "Beverages",
    "Item Name": "Masala Chai",
    Description: "Duplicate row in same file",
    Price: 99,
    Half: "",
    Full: "",
    Dietary: "VEG",
    SKU: "BV-001",
  },
  // Brand new
  {
    Category: "Specials",
    "Item Name": "Chef Tasting Platter",
    Description: "Only in reupload sheet",
    Price: 499,
    Half: "",
    Full: "",
    Dietary: "VEG",
    SKU: "SP-NEW-01",
  },
  {
    Category: "Specials",
    "Item Name": "Midnight Brownie",
    Description: "New dessert from reupload",
    Price: 149,
    Half: "",
    Full: "",
    Dietary: "VEG",
    SKU: "DS-NEW-01",
  },
];

const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), "Menu");
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer);
console.log(JSON.stringify({ path: OUT, rows: rows.length }, null, 2));
