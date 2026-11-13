import { z } from "zod";

const themeColorSchema = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Use a 6-digit hex color such as #602e31.");

// --- RESTAURANT SCHEMAS ---
const socialLinksSchema = z
  .object({
    instagram: z.string().trim().optional(),
    facebook: z.string().trim().optional(),
    twitter: z.string().trim().optional(),
    website: z.string().trim().optional(),
  })
  .optional();

export const restaurantSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Restaurant name must be at least 2 characters"),
  slug: z
    .string()
    .trim()
    .min(2, "Slug must be at least 2 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must only contain lowercase letters, numbers, and hyphens",
    ),
  logo: z.string().trim().optional(),
  coverImage: z.string().trim().optional(),
  logoUrl: z.string().trim().optional(),
  coverUrl: z.string().trim().optional(),
  coverVideo: z.string().trim().optional(),
  description: z
    .string()
    .trim()
    .max(1000, "Description cannot exceed 1000 characters")
    .optional(),
  tagline: z
    .string()
    .trim()
    .max(200, "Tagline cannot exceed 200 characters")
    .optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  address: z.string().trim().optional(),
  openingHours: z.string().trim().optional(),
  currency: z.string().trim().max(10).optional(),
  socialLinks: socialLinksSchema,
  isOpen: z.boolean().default(true),
  isActive: z.boolean().default(true),
  subscriptionEnabled: z.boolean().optional(),
  subscriptionPlan: z
    .enum(["STARTER", "PRO", "ENTERPRISE"])
    .default("PRO")
    .optional(),
  subscriptionStatus: z
    .enum(["ACTIVE", "TRIAL", "PAST_DUE", "CANCELLED"])
    .default("ACTIVE")
    .optional(),
  featureOverrides: z.record(z.string(), z.boolean()).optional(),
  theme: z
    .object({
      primaryColor: themeColorSchema.optional(),
      secondaryColor: themeColorSchema.optional(),
      accentColor: themeColorSchema.optional(),
      backgroundColor: themeColorSchema.optional(),
      textColor: themeColorSchema.optional(),
      buttonStyle: z.enum(["filled", "outlined", "gradient"]).optional(),
      borderRadius: z.enum(["sharp", "rounded", "pill"]).optional(),
    })
    .optional(),
});

export const restaurantBillingSettingsSchema = z
  .object({
    taxRatePercent: z.number().min(0).max(100).optional(),
    taxLabel: z.string().trim().max(40).optional(),
    currency: z.string().trim().max(10).optional(),
    priceMode: z.enum(["EXCLUSIVE", "INCLUSIVE"]).optional(),
    gstEnabled: z.boolean().optional(),
    gstRatePercent: z.number().min(0).max(100).optional(),
    supplyType: z.enum(["INTRA_STATE", "INTER_STATE"]).optional(),
    packagingEnabled: z.boolean().optional(),
    packagingMethod: z
      .enum(["PER_ORDER", "PER_ITEM", "PER_QUANTITY", "PERCENT_OF_SUBTOTAL"])
      .optional(),
    packagingAmount: z.number().min(0).max(1_000_000).optional(),
    packagingPercent: z.number().min(0).max(100).optional(),
    serviceChargeEnabled: z.boolean().optional(),
    serviceChargeType: z.enum(["FIXED", "PERCENT"]).optional(),
    serviceChargeAmount: z.number().min(0).max(1_000_000).optional(),
    serviceChargePercent: z.number().min(0).max(100).optional(),
    effectiveFrom: z.string().trim().max(40).optional(),
  })
  .strict();
export type RestaurantBillingSettingsInput = z.infer<typeof restaurantBillingSettingsSchema>;

export const updateRestaurantSchema = restaurantSchema.partial();
export const restaurantAdminProfileSchema = updateRestaurantSchema
  .omit({
    slug: true,
    isActive: true,
    subscriptionPlan: true,
    subscriptionStatus: true,
    subscriptionEnabled: true,
    featureOverrides: true,
    theme: true,
  })
  .extend({
    billing: restaurantBillingSettingsSchema.optional(),
  })
  .strict();

export const billingPreviewSchema = z
  .object({
    itemPrice: z.number().min(0).max(1_000_000),
    quantity: z.number().int().min(1).max(100).default(1),
    billDiscountAmount: z.number().min(0).max(1_000_000).optional(),
    billing: restaurantBillingSettingsSchema.optional(),
  })
  .strict();
export type CreateRestaurantInput = z.infer<typeof restaurantSchema>;
export type UpdateRestaurantInput = z.infer<typeof updateRestaurantSchema>;
export type RestaurantAdminProfileInput = z.infer<
  typeof restaurantAdminProfileSchema
>;

export const restaurantWifiUpdateSchema = z.object({
  ssid: z.string().trim().min(1).max(32).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), "SSID contains unsupported characters."),
  security: z.enum(["WPA2", "WPA3", "OPEN"]),
  password: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().min(8).max(63).optional(),
  ),
  clearPassword: z.boolean().default(false),
}).strict().superRefine((value, context) => {
  if (value.password !== undefined && value.clearPassword) {
    context.addIssue({ code: "custom", path: ["password"], message: "Set a password or clear it, not both." });
  }
  if (value.security === "OPEN" && value.password !== undefined) {
    context.addIssue({ code: "custom", path: ["password"], message: "Open networks cannot have a password." });
  }
});
export type RestaurantWifiUpdateInput = z.infer<typeof restaurantWifiUpdateSchema>;
