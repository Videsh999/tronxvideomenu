import type { Category, Dish } from "@/types";
import type { ImportItemDraft, ImportPreview, ImportStrategy } from "./types";
import { normalizeHeader, normalizeItemName, similarity } from "./normalize";

function dishMatchScore(draft: ImportItemDraft, dish: Dish, categoryNameById: Map<string, string>): number {
  // Prefer exact SKU match against the dish SKU (and legacy slug if SKU was stored there).
  if (draft.sku) {
    const draftSku = normalizeHeader(draft.sku);
    if (dish.sku && draftSku === normalizeHeader(dish.sku)) return 0.99;
    if (dish.slug && draftSku === normalizeHeader(dish.slug)) return 0.97;
  }
  const nameScore = similarity(draft.name, dish.name);
  const categoryName = categoryNameById.get(dish.categoryId) ?? "";
  const categoryScore = categoryName ? similarity(draft.categoryName, categoryName) : 0.5;
  return nameScore * 0.75 + categoryScore * 0.25;
}

function draftIdentity(draft: ImportItemDraft): string {
  if (draft.sku) return `sku:${normalizeHeader(draft.sku)}`;
  return `name:${normalizeItemName(draft.name).toLowerCase()}|cat:${normalizeHeader(draft.categoryName)}`;
}

/**
 * Match import rows to the live catalogue and resolve duplicates so the same item
 * is never created twice (within the file or against existing dishes).
 */
export function applyExistingMatches(
  drafts: ImportItemDraft[],
  existingDishes: Dish[],
  existingCategories: Category[],
  strategy: ImportStrategy,
): ImportPreview {
  const categoryNameById = new Map(existingCategories.map((category) => [category.id, category.name]));
  const existingCategoryNames = new Set(existingCategories.map((category) => normalizeHeader(category.name)));
  const categoriesToCreate: string[] = [];
  const categoriesExisting: string[] = [];
  const seenCategory = new Set<string>();
  const seenInFile = new Map<string, ImportItemDraft>();

  for (const draft of drafts) {
    const normalizedCategory = normalizeHeader(draft.categoryName);
    if (!seenCategory.has(normalizedCategory)) {
      seenCategory.add(normalizedCategory);
      if (existingCategoryNames.has(normalizedCategory)) categoriesExisting.push(draft.categoryName);
      else categoriesToCreate.push(draft.categoryName);
    }

    // Intra-file duplicate: keep the first occurrence only.
    const identity = draftIdentity(draft);
    const first = seenInFile.get(identity);
    if (first) {
      draft.action = "SKIP";
      draft.included = false;
      draft.matchDishId = first.matchDishId;
      draft.matchReason = `Duplicate of row “${first.name}” in this file — kept once.`;
      draft.warnings.push("Duplicate in this Excel file — skipped so the item appears only once.");
      continue;
    }
    seenInFile.set(identity, draft);

    let best: { dish: Dish; score: number } | null = null;
    for (const dish of existingDishes) {
      const score = dishMatchScore(draft, dish, categoryNameById);
      if (!best || score > best.score) best = { dish, score };
    }

    if (best && best.score >= 0.86) {
      draft.matchDishId = best.dish.id;
      draft.matchReason = `Matched existing “${best.dish.name}” (${Math.round(best.score * 100)}% confidence).`;
      draft.confidence = Math.min(draft.confidence, best.score);
      if (strategy === "CREATE_ONLY") {
        draft.action = "SKIP";
        draft.included = false;
        draft.warnings.push("Already in menu — skipped (Create new only). No duplicate created.");
      } else if (strategy === "UPDATE_MATCHING") {
        draft.action = "UPDATE";
        draft.included = draft.errors.length === 0;
        draft.warnings.push("Matched existing dish — will update once (not create a second copy).");
      } else {
        // SMART_MERGE — update only when admin includes the row.
        draft.action = "UPDATE";
        draft.included = false;
        draft.warnings.push("Smart Merge: matched existing dish. Include the row to update it once.");
      }
    } else if (draft.errors.length) {
      draft.action = "NEEDS_REVIEW";
      draft.included = false;
    } else {
      draft.action = "CREATE";
      draft.included = true;
    }
  }

  const validItems = drafts.filter((item) => item.errors.length === 0).length;
  const createCount = drafts.filter((item) => item.action === "CREATE").length;
  const updateCount = drafts.filter((item) => item.action === "UPDATE").length;
  const skipCount = drafts.filter((item) => item.action === "SKIP").length;
  const needsReviewCount = drafts.filter((item) => item.action === "NEEDS_REVIEW").length;
  const warningCount = drafts.reduce((sum, item) => sum + item.warnings.length, 0);
  const averageConfidence =
    drafts.length === 0 ? 0 : drafts.reduce((sum, item) => sum + item.confidence, 0) / drafts.length;

  return {
    strategy,
    categoriesToCreate,
    categoriesExisting,
    items: drafts,
    summary: {
      totalRows: drafts.length,
      validItems,
      invalidItems: drafts.length - validItems,
      createCount,
      updateCount,
      skipCount,
      needsReviewCount,
      warningCount,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
    },
  };
}
