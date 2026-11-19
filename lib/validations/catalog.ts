import { z } from "zod";

// --- CATEGORY SCHEMAS ---
export const categorySchema = z.object({
  restaurantId: z.string().min(1, "Restaurant ID is required"),
  name: z
    .string()
    .trim()
    .min(1, "Category name is required")
    .max(100, "Name too long"),
  slug: z.string().trim().optional(),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional(),
  sortOrder: z
    .number()
    .int()
    .min(0, "Sort order must be non-negative")
    .default(0),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = categorySchema
  .partial()
  .omit({ restaurantId: true });
export type CreateCategoryInput = z.infer<typeof categorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// --- ADD-ON GROUP SCHEMAS ---
export const addonGroupSchema = z.object({
  restaurantId: z.string().min(1, "Restaurant ID is required"),
  name: z
    .string()
    .trim()
    .min(1, "Group name is required")
    .max(100, "Name too long"),
  isRequired: z.boolean().default(false),
  minSelect: z
    .number()
    .int()
    .min(0, "Min select must be 0 or higher")
    .default(0),
  maxSelect: z
    .number()
    .int()
    .min(1, "Max select must be at least 1")
    .default(1),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export const updateAddonGroupSchema = addonGroupSchema
  .partial()
  .omit({ restaurantId: true });
export type CreateAddonGroupInput = z.infer<typeof addonGroupSchema>;
export type UpdateAddonGroupInput = z.infer<typeof updateAddonGroupSchema>;

// --- ADD-ON SCHEMAS ---
export const addonSchema = z.object({
  addonGroupId: z.string().min(1, "Add-on Group ID is required"),
  name: z
    .string()
    .trim()
    .min(1, "Add-on name is required")
    .max(100, "Name too long"),
  price: z.number().min(0, "Price must be greater than or equal to 0"),
  isActive: z.boolean().default(true),
  isAvailable: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const updateAddonSchema = addonSchema
  .partial()
  .omit({ addonGroupId: true });
export type CreateAddonInput = z.infer<typeof addonSchema>;
export type UpdateAddonInput = z.infer<typeof updateAddonSchema>;

// --- DISH SCHEMAS ---
export const dishSchema = z.object({
  restaurantId: z.string().min(1, "Restaurant ID is required"),
  categoryId: z.string().min(1, "Category ID is required"),
  name: z
    .string()
    .trim()
    .min(1, "Dish name is required")
    .max(150, "Name too long"),
  slug: z.string().trim().optional(),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional(),
  price: z.number().min(0, "Price must be greater than or equal to 0"),
  preparationTime: z
    .number()
    .int()
    .min(0, "Preparation time must be non-negative")
    .optional(),
  type: z.enum(["VEG", "NON_VEG"]).default("VEG"),
  isAvailable: z.boolean().default(true),
  isCustomizable: z.boolean().default(false),
  image: z.string().trim().optional(),
  video: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  videoUrl: z.string().trim().optional(),
  videoPosterUrl: z.string().trim().optional(),
  gallery: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(64),
        type: z.enum(["IMAGE", "VIDEO"]),
        url: z.string().trim().min(1, "Media URL is required").max(2048),
        posterUrl: z.string().trim().max(2048).optional(),
      }),
    )
    .max(12, "A dish can have at most 12 gallery items")
    .optional(),
  sortOrder: z.number().int().min(0).default(0),
  addonGroupIds: z.array(z.string()).optional(),
  sku: z.string().trim().max(64).optional(),
  kitchenStation: z.enum(["MAIN", "BAR", "BAKERY", "DESSERT", "OTHER"]).optional(),
  variants: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().trim().min(1).max(80),
        price: z.number().min(0),
        isAvailable: z.boolean().optional(),
        sortOrder: z.number().int().min(0).optional(),
        sku: z.string().trim().max(64).optional(),
      }),
    )
    .max(20)
    .optional(),
});

export const updateDishSchema = dishSchema
  .partial()
  .omit({ restaurantId: true });
export type CreateDishInput = z.infer<typeof dishSchema>;
export type UpdateDishInput = z.infer<typeof updateDishSchema>;
