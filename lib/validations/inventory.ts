import { z } from "zod";

export const inventoryUnitSchema = z.enum(["g", "kg", "ml", "l", "pcs", "dozen"]);

export const createIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    baseUnit: inventoryUnitSchema,
    sku: z.string().trim().max(64).optional(),
    conversions: z.record(z.string(), z.number().positive()).optional(),
    quantityOnHand: z.number().min(0).optional(),
    reorderLevel: z.number().min(0).optional(),
    reorderQuantity: z.number().min(0).optional(),
    averageUnitCost: z.number().min(0).optional(),
    expiryDate: z.string().optional(),
  })
  .strict();

/** Metadata update — stock quantity changes must go through stockAdjustSchema / movements. */
export const updateIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    sku: z.string().trim().max(64).optional().nullable(),
    baseUnit: inventoryUnitSchema.optional(),
    conversions: z.record(z.string(), z.number().positive()).optional(),
    reorderLevel: z.number().min(0).optional().nullable(),
    reorderQuantity: z.number().min(0).optional().nullable(),
    averageUnitCost: z.number().min(0).optional().nullable(),
    expiryDate: z.string().trim().max(40).optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

export const upsertRecipeSchema = z
  .object({
    dishId: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    yieldPortions: z.number().int().min(1).max(1000),
    lines: z
      .array(
        z.object({
          ingredientId: z.string().min(1),
          quantity: z.number().positive(),
          unit: inventoryUnitSchema,
        }),
      )
      .min(1)
      .max(100),
  })
  .strict();

export const stockAdjustSchema = z
  .object({
    ingredientId: z.string().min(1),
    quantityDelta: z.number(),
    kind: z.enum(["ADJUSTMENT", "WASTAGE", "RECONCILIATION"]),
    note: z.string().trim().max(500).optional(),
    countedQuantity: z.number().min(0).optional(),
  })
  .strict();

export const createSupplierSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    contactName: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
    address: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const createPurchaseOrderSchema = z
  .object({
    supplierId: z.string().min(1),
    expectedAt: z.string().optional(),
    notes: z.string().trim().max(1000).optional(),
    lines: z
      .array(
        z.object({
          ingredientId: z.string().min(1),
          quantity: z.number().positive(),
          unit: inventoryUnitSchema,
          unitCost: z.number().min(0),
        }),
      )
      .min(1)
      .max(200),
  })
  .strict();

export const receivePurchaseOrderSchema = z
  .object({
    invoiceNumber: z.string().trim().max(80).optional(),
    notes: z.string().trim().max(1000).optional(),
    lines: z
      .array(
        z.object({
          ingredientId: z.string().min(1),
          quantity: z.number().positive(),
          unit: inventoryUnitSchema,
          unitCost: z.number().min(0),
        }),
      )
      .min(1),
  })
  .strict();
