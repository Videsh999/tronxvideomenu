import type { ColumnMapping, ImportAddonDraft, ImportItemDraft, ImportVariant } from "./types";
import {
  normalizeItemName,
  normalizeOptionalString,
  parseBooleanAvailability,
  parseDietary,
  parseMoney,
} from "./normalize";
import { validateImportItemDraft } from "./validate-draft";

function cell(row: string[], index: number | undefined): string {
  if (index === undefined || index < 0) return "";
  return (row[index] ?? "").trim();
}

function looksLikeCategoryHeader(row: string[], mappings: ColumnMapping[]): boolean {
  const nonEmpty = row.map((value) => value.trim()).filter(Boolean);
  if (nonEmpty.length === 0) return false;
  if (nonEmpty.length > 2) return false;
  const nameIndex = mappings.find((m) => m.canonical === "itemName")?.columnIndex;
  const categoryIndex = mappings.find((m) => m.canonical === "category")?.columnIndex;
  const priceIndexes = mappings.filter((m) => m.canonical === "price").map((m) => m.columnIndex);
  const itemName = nameIndex !== undefined ? cell(row, nameIndex) : "";
  const categoryLabel = categoryIndex !== undefined ? cell(row, categoryIndex) : "";
  const hasPrice = priceIndexes.some((index) => parseMoney(cell(row, index)) !== null);
  if (hasPrice) return false;
  // Category banner rows: only a label in category/first column, no item name/price.
  if (itemName) return false;
  return Boolean(categoryLabel || nonEmpty[0]) && nonEmpty.length === 1;
}

export function buildItemDraftsFromGrid(
  grid: string[][],
  mappings: ColumnMapping[],
  defaultCategory = "Imported",
): ImportItemDraft[] {
  if (grid.length < 2) return [];

  const byCanonical = (canonical: ColumnMapping["canonical"]) =>
    mappings.filter((m) => m.canonical === canonical);

  const nameCol = byCanonical("itemName")[0]?.columnIndex;
  const categoryCol = byCanonical("category")[0]?.columnIndex;
  const descriptionCol = byCanonical("description")[0]?.columnIndex;
  const priceCols = byCanonical("price");
  const compareCol = byCanonical("compareAtPrice")[0]?.columnIndex;
  const dietaryCol = byCanonical("dietary")[0]?.columnIndex;
  const prepCol = byCanonical("prepTime")[0]?.columnIndex;
  const skuCol = byCanonical("sku")[0]?.columnIndex;
  const tagsCol = byCanonical("tags")[0]?.columnIndex;
  const availabilityCol = byCanonical("availability")[0]?.columnIndex;
  const addonGroupCol = byCanonical("addonGroup")[0]?.columnIndex;
  const addonNameCol = byCanonical("addonName")[0]?.columnIndex;
  const addonPriceCol = byCanonical("addonPrice")[0]?.columnIndex;

  let currentCategory = defaultCategory;
  const drafts: ImportItemDraft[] = [];
  const draftByKey = new Map<string, ImportItemDraft>();

  for (let rowIndex = 1; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex] ?? [];
    const spreadsheetRow = rowIndex + 1; // 1-based including header approximation

    if (looksLikeCategoryHeader(row, mappings)) {
      const label =
        (categoryCol !== undefined ? cell(row, categoryCol) : "") ||
        row.find((value) => value.trim())?.trim() ||
        "";
      if (label) currentCategory = normalizeItemName(label);
      continue;
    }

    const name = normalizeItemName(cell(row, nameCol));
    const categoryFromCol = normalizeItemName(cell(row, categoryCol));
    const categoryName = categoryFromCol || currentCategory || defaultCategory;

    const addonName = normalizeItemName(cell(row, addonNameCol));
    if (!name && addonName) {
      // Standalone addon row attached to previous item when possible.
      const previous = drafts[drafts.length - 1];
      if (previous) {
        const price = parseMoney(cell(row, addonPriceCol)) ?? 0;
        previous.addons.push({
          groupName: normalizeItemName(cell(row, addonGroupCol)) || "Add-ons",
          name: addonName,
          price,
        });
      }
      continue;
    }

    if (!name) {
      const hasPrice = priceCols.some((mapping) => cell(row, mapping.columnIndex).length > 0);
      const hasSku = Boolean(cell(row, skuCol));
      const hasDescription = Boolean(cell(row, descriptionCol));
      if (!hasPrice && !hasSku && !hasDescription) continue;
      const invalid = validateImportItemDraft({
        rowKey: `missing-name-${spreadsheetRow}`,
        sourceRowNumbers: [spreadsheetRow],
        name: "",
        categoryName: categoryName || defaultCategory,
        description: normalizeOptionalString(cell(row, descriptionCol)),
        price: null,
        compareAtPrice: null,
        dietary: "UNKNOWN",
        prepTimeMinutes: null,
        sku: normalizeOptionalString(cell(row, skuCol)),
        tags: [],
        isAvailable: true,
        variants: [],
        addons: [],
        confidence: 0,
        action: "CREATE",
        errors: [],
        warnings: [],
        included: true,
      });
      drafts.push(invalid);
      continue;
    }

    const variants: ImportVariant[] = [];
    let basePrice: number | null = null;
    for (const priceMapping of priceCols) {
      const amount = parseMoney(cell(row, priceMapping.columnIndex));
      if (amount === null) continue;
      if (priceMapping.variantName) {
        variants.push({ name: priceMapping.variantName, price: amount, confidence: priceMapping.confidence });
      } else if (basePrice === null) {
        basePrice = amount;
      }
    }

    if (variants.length && basePrice === null) {
      basePrice = Math.min(...variants.map((variant) => variant.price));
    }

    const dietary = parseDietary(cell(row, dietaryCol));
    const availability = parseBooleanAvailability(cell(row, availabilityCol));
    const prepRaw = cell(row, prepCol);
    const prepTimeMinutes = prepRaw ? Number.parseInt(prepRaw.replace(/[^\d]/g, ""), 10) : NaN;

    const addons: ImportAddonDraft[] = [];
    if (addonName) {
      addons.push({
        groupName: normalizeItemName(cell(row, addonGroupCol)) || "Add-ons",
        name: addonName,
        price: parseMoney(cell(row, addonPriceCol)) ?? 0,
      });
    }

    const sku = normalizeOptionalString(cell(row, skuCol));
    const key = `${(sku || name).toLowerCase()}::${categoryName.toLowerCase()}`;
    const existing = draftByKey.get(key);
    if (existing) {
      existing.sourceRowNumbers.push(spreadsheetRow);
      for (const variant of variants) {
        if (!existing.variants.some((entry) => entry.name === variant.name)) existing.variants.push(variant);
      }
      existing.addons.push(...addons);
      if (existing.price === null && basePrice !== null) existing.price = basePrice;
      continue;
    }

    const mappingConfidence =
      (priceCols.reduce((sum, mapping) => sum + mapping.confidence, 0) / Math.max(1, priceCols.length) +
        (byCanonical("itemName")[0]?.confidence ?? 0.5)) /
      2;

    const draft = validateImportItemDraft({
      rowKey: key,
      sourceRowNumbers: [spreadsheetRow],
      name,
      categoryName,
      description: normalizeOptionalString(cell(row, descriptionCol)),
      price: basePrice,
      compareAtPrice: parseMoney(cell(row, compareCol)),
      dietary,
      prepTimeMinutes: Number.isFinite(prepTimeMinutes) ? prepTimeMinutes : null,
      sku,
      tags: cell(row, tagsCol)
        ? cell(row, tagsCol)
            .split(/[,|;]/)
            .map((tag) => normalizeOptionalString(tag))
            .filter((tag): tag is string => Boolean(tag))
        : [],
      isAvailable: availability ?? true,
      variants,
      addons,
      confidence: Math.round(mappingConfidence * 100) / 100,
      action: "CREATE",
      errors: [],
      warnings: dietary === "UNKNOWN" && dietaryCol !== undefined ? ["Dietary type could not be determined."] : [],
      included: true,
    });

    draftByKey.set(key, draft);
    drafts.push(draft);
  }

  return drafts;
}
