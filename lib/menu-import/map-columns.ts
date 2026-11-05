import type { CanonicalColumn, ColumnMapping } from "./types";
import { normalizeHeader, similarity } from "./normalize";

const SYNONYMS: Record<Exclude<CanonicalColumn, "ignore">, string[]> = {
  itemName: [
    "item name", "item", "dish", "dish name", "food name", "product", "product name",
    "menu item", "name", "title", "particulars", "items",
  ],
  category: [
    "category", "section", "menu section", "group", "course", "cuisine",
    "menu category", "department",
  ],
  description: [
    "description", "desc", "details", "about", "ingredients note", "notes", "long description",
  ],
  price: [
    "price", "selling price", "sale price", "rate", "amount", "mrp sell", "sell price",
    "cost to customer", "regular", "regular price",
  ],
  compareAtPrice: ["original price", "mrp", "compare at", "strike price", "list price"],
  dietary: ["dietary", "veg non veg", "veg", "food type", "diet", "v/nv", "type veg", "type", "veg/nonveg"],
  prepTime: ["prep time", "preparation time", "cook time", "time", "mins", "minutes"],
  sku: ["sku", "item code", "code", "product code", "id", "item id"],
  tags: ["tags", "labels", "keywords"],
  availability: ["available", "availability", "in stock", "status", "active"],
  addonGroup: ["addon group", "add on group", "modifier group", "option group", "customization"],
  addonName: ["addon", "add on", "modifier", "extra", "option", "addon name"],
  addonPrice: ["addon price", "add on price", "modifier price", "extra price", "option price"],
};

const VARIANT_PATTERNS: Array<{ name: string; patterns: RegExp[] }> = [
  { name: "Half", patterns: [/^half(?:\s*plate)?$/, /^half(?:\s*price)?$/, /^1\/2$/] },
  { name: "Full", patterns: [/^full(?:\s*plate)?$/, /^full(?:\s*price)?$/] },
  { name: "Regular", patterns: [/^regular$/, /^reg$/, /^standard$/] },
  { name: "Small", patterns: [/^small$/, /^sm$/, /^s size$/] },
  { name: "Medium", patterns: [/^medium$/, /^med$/, /^m size$/] },
  { name: "Large", patterns: [/^large$/, /^lg$/, /^l size$/] },
  { name: "Family", patterns: [/^family$/, /^share$/] },
];

function scoreCanonical(header: string, canonical: Exclude<CanonicalColumn, "ignore">): number {
  const normalized = normalizeHeader(header);
  let best = 0;
  for (const synonym of SYNONYMS[canonical]) {
    if (normalized === synonym) return 1;
    if (normalized.includes(synonym) || synonym.includes(normalized)) {
      best = Math.max(best, 0.86);
    }
    best = Math.max(best, similarity(normalized, synonym));
  }
  return best;
}

function detectVariant(header: string): { name: string; confidence: number } | null {
  const normalized = normalizeHeader(header);
  for (const variant of VARIANT_PATTERNS) {
    for (const pattern of variant.patterns) {
      if (pattern.test(normalized)) return { name: variant.name, confidence: 0.95 };
    }
    if (normalized.includes(variant.name.toLowerCase()) && normalized.includes("price")) {
      return { name: variant.name, confidence: 0.88 };
    }
  }
  // "Half Plate" / "Full Rate" style
  const plate = normalized.match(/^(half|full|regular|small|medium|large|family)\b/);
  if (plate) {
    const name = plate[1]!.charAt(0).toUpperCase() + plate[1]!.slice(1);
    return { name, confidence: 0.8 };
  }
  return null;
}

export function suggestColumnMappings(headers: string[]): ColumnMapping[] {
  const used = new Set<CanonicalColumn>();
  const mappings: ColumnMapping[] = [];

  headers.forEach((header, columnIndex) => {
    const variant = detectVariant(header);
    if (variant) {
      mappings.push({
        sourceHeader: header,
        columnIndex,
        canonical: "price",
        confidence: variant.confidence,
        variantName: variant.name,
      });
      return;
    }

    let best: { canonical: CanonicalColumn; confidence: number } = { canonical: "ignore", confidence: 0 };
    (Object.keys(SYNONYMS) as Array<Exclude<CanonicalColumn, "ignore">>).forEach((canonical) => {
      const confidence = scoreCanonical(header, canonical);
      if (confidence > best.confidence) best = { canonical, confidence };
    });

    if (best.confidence < 0.55) {
      mappings.push({ sourceHeader: header, columnIndex, canonical: "ignore", confidence: best.confidence });
      return;
    }

    // Prefer unique assignment for core fields except price variants already handled.
    if (used.has(best.canonical) && best.canonical !== "tags") {
      mappings.push({ sourceHeader: header, columnIndex, canonical: "ignore", confidence: best.confidence * 0.5 });
      return;
    }

    used.add(best.canonical);
    mappings.push({
      sourceHeader: header,
      columnIndex,
      canonical: best.canonical,
      confidence: best.confidence,
    });
  });

  return mappings;
}

export function mappingNeedsConfirmation(mappings: ColumnMapping[]): boolean {
  const hasName = mappings.some((m) => m.canonical === "itemName" && m.confidence >= 0.55);
  const hasPrice = mappings.some((m) => m.canonical === "price" && m.confidence >= 0.55);
  const lowConfidence = mappings.some((m) => m.canonical !== "ignore" && m.confidence < 0.7);
  return !hasName || !hasPrice || lowConfidence;
}
