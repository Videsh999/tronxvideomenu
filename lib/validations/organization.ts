import { z } from "zod";
import { inventoryUnitSchema } from "./inventory";

export const createOrganizationSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  })
  .strict();

export const attachOutletSchema = z
  .object({
    restaurantId: z.string().min(1),
    organizationId: z.string().min(1),
  })
  .strict();

export const createStockTransferSchema = z
  .object({
    organizationId: z.string().min(1),
    fromRestaurantId: z.string().min(1),
    toRestaurantId: z.string().min(1),
    lines: z
      .array(
        z.object({
          ingredientId: z.string().min(1),
          quantity: z.number().positive(),
          unit: inventoryUnitSchema,
        }),
      )
      .min(1),
  })
  .strict();
