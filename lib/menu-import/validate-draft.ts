import { normalizeImportItemDraft } from "./item-schema";
import { normalizeOptionalString, normalizeRequiredString } from "./normalize";
import type { ImportItemDraft } from "./types";

export type ValidationSeverity = "error" | "warning" | "info";

export type FieldValidationMessage = {
  severity: ValidationSeverity;
  rowNumbers: number[];
  field: string;
  message: string;
};

/**
 * Recompute blocking errors / warnings for a draft after normalization.
 * Optional blanks (description, sku, tags, prep notes) never become blocking errors.
 */
export function validateImportItemDraft(raw: ImportItemDraft): ImportItemDraft {
  const item = normalizeImportItemDraft(raw);
  const errors: string[] = [];
  const warnings: string[] = [...(item.warnings ?? [])].filter(
    (message) =>
      !/description is empty/i.test(message) &&
      !/sku is empty/i.test(message),
  );

  const name = normalizeRequiredString(item.name);
  const categoryName = normalizeRequiredString(item.categoryName);

  if (!name) {
    errors.push("Dish name is missing. Please correct this row.");
  }
  if (!categoryName) {
    errors.push("Category is missing. Please correct this row.");
  }

  const hasVariantPrice = item.variants.some((variant) => Number.isFinite(variant.price) && variant.price >= 0);
  if ((item.price === null || item.price === undefined) && !hasVariantPrice) {
    errors.push("Price is missing or invalid. Please correct this row.");
  } else if (item.price !== null && item.price !== undefined && (!Number.isFinite(item.price) || item.price < 0)) {
    errors.push("Price is invalid. Please correct this row.");
  }

  // Informational — optional blanks are allowed (not shown as warnings by default).
  void normalizeOptionalString(item.description);
  void normalizeOptionalString(item.sku);

  const action =
    errors.length > 0
      ? "NEEDS_REVIEW"
      : item.action === "SKIP"
        ? "SKIP"
        : item.action === "UPDATE"
          ? "UPDATE"
          : "CREATE";

  return {
    ...item,
    name,
    categoryName,
    errors,
    warnings,
    action: errors.length ? "NEEDS_REVIEW" : action,
    included: errors.length === 0 ? item.included && action !== "SKIP" : false,
  };
}

export function summarizeValidation(items: ImportItemDraft[]): {
  errors: FieldValidationMessage[];
  warnings: FieldValidationMessage[];
  infos: FieldValidationMessage[];
  validRowCount: number;
  invalidRowCount: number;
  warningCount: number;
} {
  const errors: FieldValidationMessage[] = [];
  const warnings: FieldValidationMessage[] = [];
  const infos: FieldValidationMessage[] = [];

  for (const item of items) {
    const rows = item.sourceRowNumbers.length ? item.sourceRowNumbers : [];
    for (const message of item.errors) {
      errors.push({
        severity: "error",
        rowNumbers: rows,
        field: /name/i.test(message) ? "name" : /price/i.test(message) ? "price" : /category/i.test(message) ? "category" : "item",
        message: rows.length
          ? `Row ${rows.join(", ")}: ${message}`
          : message,
      });
    }
    for (const message of item.warnings) {
      warnings.push({
        severity: "warning",
        rowNumbers: rows,
        field: "item",
        message: rows.length ? `Row ${rows.join(", ")}: ${message}` : message,
      });
    }
  }

  const validRowCount = items.filter((item) => item.errors.length === 0).length;
  return {
    errors,
    warnings,
    infos,
    validRowCount,
    invalidRowCount: items.length - validRowCount,
    warningCount: warnings.length,
  };
}
