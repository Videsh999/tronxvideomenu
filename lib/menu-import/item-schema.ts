import { z } from "zod";
import { normalizeOptionalString, normalizeRequiredString } from "./normalize";
import type { ImportItemDraft } from "./types";

/** Accept null/undefined/whitespace from Excel → Mongo → JSON round-trips. */
const optionalTrimmedString = z.preprocess(
  (value) => normalizeOptionalString(value),
  z.string().max(2000).optional(),
);

const requiredName = z.preprocess(
  (value) => normalizeRequiredString(value),
  z.string().trim().min(1).max(200),
);

const requiredCategory = z.preprocess(
  (value) => normalizeRequiredString(value),
  z.string().trim().min(1).max(120),
);

export const importItemDraftSchema = z.object({
  rowKey: z.string().min(1),
  sourceRowNumbers: z.array(z.number().int().positive()),
  name: requiredName,
  categoryName: requiredCategory,
  description: optionalTrimmedString,
  price: z.number().nullable(),
  compareAtPrice: z.number().nullable().optional(),
  dietary: z.enum(["VEG", "NON_VEG", "UNKNOWN"]).optional(),
  prepTimeMinutes: z.number().nullable().optional(),
  sku: optionalTrimmedString,
  tags: z.preprocess((value) => {
    if (value === null || value === undefined) return [];
    if (!Array.isArray(value)) return [];
    return value
      .map((tag) => normalizeOptionalString(tag))
      .filter((tag): tag is string => Boolean(tag));
  }, z.array(z.string())),
  isAvailable: z.boolean(),
  variants: z.array(
    z.object({
      name: z.string().min(1),
      price: z.number(),
      confidence: z.number(),
    }),
  ),
  addons: z.array(
    z.object({
      groupName: z.string().min(1),
      name: z.string().min(1),
      price: z.number(),
      isRequired: z.boolean().optional(),
    }),
  ),
  confidence: z.number(),
  action: z.enum(["CREATE", "UPDATE", "SKIP", "NEEDS_REVIEW"]),
  matchDishId: optionalTrimmedString,
  matchReason: optionalTrimmedString,
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  included: z.boolean(),
});

export const importPreviewItemsBodySchema = z.object({
  items: z.array(importItemDraftSchema),
});

/** Normalize a draft in-memory (before persist / API send). */
export function normalizeImportItemDraft(item: ImportItemDraft): ImportItemDraft {
  return {
    ...item,
    name: normalizeRequiredString(item.name),
    categoryName: normalizeRequiredString(item.categoryName),
    description: normalizeOptionalString(item.description),
    sku: normalizeOptionalString(item.sku),
    matchDishId: normalizeOptionalString(item.matchDishId),
    matchReason: normalizeOptionalString(item.matchReason),
    tags: (item.tags ?? [])
      .map((tag) => normalizeOptionalString(tag))
      .filter((tag): tag is string => Boolean(tag)),
    prepTimeMinutes:
      item.prepTimeMinutes === null || item.prepTimeMinutes === undefined
        ? null
        : Number.isFinite(item.prepTimeMinutes)
          ? item.prepTimeMinutes
          : null,
  };
}

export function formatImportZodError(error: z.ZodError): string {
  const issues = error.issues.slice(0, 25).map((issue) => {
    const path = issue.path
      .map((part) => (typeof part === "number" ? `row ${part + 1}` : String(part)))
      .join(" → ");
    const field = String(issue.path[issue.path.length - 1] ?? "field");
    if (field === "description" || field === "sku") {
      return `${path}: empty ${field} should be allowed — please retry (server will normalize blank cells).`;
    }
    if (field === "name") return `${path}: Dish name is missing. Please correct this row.`;
    if (field === "price") return `${path}: Price is invalid or missing.`;
    return `${path}: ${issue.message}`;
  });
  const extra = error.issues.length > 25 ? ` (+${error.issues.length - 25} more)` : "";
  return `Import validation failed (${error.issues.length} issue${error.issues.length === 1 ? "" : "s"}). ${issues.join(" ")}${extra}`;
}
