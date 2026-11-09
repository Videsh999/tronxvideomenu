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
    upiEnabled: z.boolean().optional(),
    upiId: z.string().trim().max(120).refine(
      (value) => value === "" || /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,64}$/.test(value),
      "Enter a valid UPI ID, for example merchant@bank",
    ).optional(),
    upiPayeeName: z.string().trim().max(120).optional(),
    upiStaticQrUrl: z.string().trim().url().max(2000).or(z.literal("")).optional(),
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

export const createTableSchema = z.object({
  locationType: z.enum(["TABLE", "ROOM"]).default("TABLE"),
  tableNumber: z.number().int().min(1).max(9999),
  label: z.string().trim().max(80).optional(),
  capacity: z.number().int().min(1).max(1000),
  isActive: z.boolean().default(true),
  status: z.enum(["OPEN", "OCCUPIED", "CLOSED"]).default("OPEN"),
});
export const updateTableSchema = createTableSchema.partial().extend({
  isActive: z.boolean().optional(),
  status: z.enum(["OPEN", "OCCUPIED", "CLOSED"]).optional(),
});
export const placeOrderSchema = z.object({
  slug: z.string().min(1),
  locationType: z.enum(["TABLE", "ROOM"]).default("TABLE"),
  tableNumber: z.number().int().min(1),
  tableSessionId: z.string().trim().min(1).max(120).optional(),
  idempotencyKey: z.string().uuid(),
  items: z
    .array(
      z.object({
        dishId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
        expectedUnitPrice: z.number().min(0),
        selections: z
          .array(
            z.object({
              groupId: z.string().min(1),
              addons: z
                .array(
                  z.object({
                    addonId: z.string().min(1),
                    expectedUnitPrice: z.number().min(0),
                  }),
                )
                .max(20),
            }),
          )
          .max(30),
      }),
    )
    .min(1)
    .max(50),
});
export type CreateTableInput = z.infer<typeof createTableSchema>;
export type UpdateTableInput = z.infer<typeof updateTableSchema>;
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

const reservationDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD");
const reservationTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, "Time must use HH:mm");
const reservationEmailSchema = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().trim().email().max(254).optional(),
);
const reservationPhoneSchema = z.string().trim().min(7).max(24).regex(/^\+?[\d\s().-]+$/).refine((value) => value.replace(/\D/g, "").length >= 7 && value.replace(/\D/g, "").length <= 15, "Enter a valid phone number");

export const reservationAvailabilitySchema = z.object({
  slug: z.string().trim().min(1).max(120),
  reservationDate: reservationDateSchema,
  startTime: reservationTimeSchema,
  guestCount: z.number().int().min(1).max(1000),
});
export type ReservationAvailabilityInput = z.infer<typeof reservationAvailabilitySchema>;
export const createReservationSchema = reservationAvailabilitySchema.extend({
  tableId: z.string().trim().min(1).max(200),
  customerName: z.string().trim().min(2).max(100),
  customerPhone: reservationPhoneSchema,
  customerEmail: reservationEmailSchema,
  specialRequest: z.string().trim().max(1000).optional(),
});
export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export const updateReservationStatusSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"]),
});

export const captainLoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
  restaurantSlug: z.string().trim().min(1).max(120),
});
export const restaurantAdminLoginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(256),
  restaurantSlug: z.string().trim().min(1).max(120).optional(),
});
export const restaurantAdminCredentialSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
}).strict();
export const restaurantAdminStatusSchema = z.object({ isActive: z.boolean() }).strict();
export const createCaptainSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
  employeeCode: z.string().trim().max(40).optional(),
});
export const captainPermissionsSchema = z
  .object({
    viewBill: z.boolean().optional(),
    requestBill: z.boolean().optional(),
    recordCashPayment: z.boolean().optional(),
    recordUpiPayment: z.boolean().optional(),
    recordCardPayment: z.boolean().optional(),
    applyCoupon: z.boolean().optional(),
    applyDiscount: z.boolean().optional(),
    printReceipt: z.boolean().optional(),
    maxDiscountPercent: z.number().min(0).max(100).optional(),
    maxDiscountAmount: z.number().min(0).max(1_000_000).optional(),
  })
  .strict();
export type CaptainPermissionsInput = z.infer<typeof captainPermissionsSchema>;
export const updateCaptainSchema = z
  .object({
    isActive: z.boolean().optional(),
    name: z.string().trim().min(2).max(100).optional(),
    employeeCode: z.string().trim().max(40).nullable().optional(),
    permissions: captainPermissionsSchema.optional(),
  })
  .refine(
    (value) =>
      value.isActive !== undefined ||
      value.name !== undefined ||
      value.employeeCode !== undefined ||
      value.permissions !== undefined,
    {
      message: "Provide at least one field to update.",
    },
  );
export const assignCaptainTablesSchema = z
  .object({
    tableIds: z.array(z.string().min(1)).max(500),
    note: z.string().trim().max(300).optional(),
  })
  .strict();
export const resetCaptainPasswordSchema = z.object({ password: z.string().min(8).max(256) });
export const captainOrderStatusSchema = z.object({
  status: z.enum([
    "ACCEPTED",
    "PREPARING",
    "READY",
    "SERVED",
    "COMPLETED",
    "CANCELLED",
    "REJECTED",
  ]),
});

export const recordPaymentSchema = z
  .object({
    method: z.enum(["CASH", "UPI", "CARD"]),
    amount: z.number().positive().max(1_000_000).optional(),
  })
  .strict();
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const correctPaymentSchema = z
  .object({
    action: z.enum(["CORRECTION", "REVERSAL"]),
    method: z.enum(["CASH", "UPI", "CARD"]).optional(),
    reason: z
      .string()
      .trim()
      .min(5, "Reason must be at least 5 characters")
      .max(300, "Reason must not exceed 300 characters"),
  })
  .strict()
  .refine((data) => data.action !== "CORRECTION" || !!data.method, {
    message: "A payment method (CASH, UPI, CARD) is required for payment correction.",
    path: ["method"],
  });
export type CorrectPaymentInput = z.infer<typeof correctPaymentSchema>;

export const refundPaymentSchema = z
  .object({
    amount: z.number().positive().max(1_000_000),
    method: z.enum(["CASH", "UPI", "CARD"]),
    reason: z.string().trim().min(5).max(300),
  })
  .strict();
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

export const posOrderItemSchema = z.object({
  dishId: z.string().min(1),
  variantId: z.string().min(1).optional(),
  quantity: z.number().int().min(1).max(99),
  itemDiscountAmount: z.number().min(0).max(1_000_000).optional(),
  note: z.string().trim().max(500).optional(),
  selections: z
    .array(
      z.object({
        groupId: z.string().min(1),
        addons: z.array(z.object({ addonId: z.string().min(1) })).max(20),
      }),
    )
    .max(30)
    .default([]),
});

export const placePosOrderSchema = z
  .object({
    channel: z.enum(["POS_DINE_IN", "POS_TAKEAWAY", "POS_DELIVERY"]),
    tableNumber: z.number().int().min(0).max(9999).optional(),
    guestCount: z.number().int().min(1).max(100).optional(),
    orderNote: z.string().trim().max(1000).optional(),
    billDiscountAmount: z.number().min(0).max(1_000_000).optional(),
    /** Server validates; client must not send discount amounts. */
    couponCode: z.string().trim().min(3).max(40).optional(),
    customerPhone: z.string().trim().min(7).max(24).optional(),
    redeemLoyaltyPoints: z.number().int().min(0).max(1_000_000).optional(),
    idempotencyKey: z.string().uuid(),
    shiftId: z.string().min(1).optional(),
    items: z.array(posOrderItemSchema).min(1).max(80),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.channel === "POS_DINE_IN" && (value.tableNumber == null || value.tableNumber < 1)) {
      context.addIssue({
        code: "custom",
        path: ["tableNumber"],
        message: "Select a table for dine-in orders.",
      });
    }
  });
export type PlacePosOrderInput = z.infer<typeof placePosOrderSchema>;

/** Captain floor order — same item shape as POS; dine-in table required; phone optional. */
export const placeCaptainOrderSchema = z
  .object({
    tableNumber: z.number().int().min(1).max(9999),
    guestCount: z.number().int().min(1).max(100).optional(),
    guestName: z.string().trim().max(80).optional(),
    orderNote: z.string().trim().max(1000).optional(),
    customerPhone: z.string().trim().min(7).max(24).optional(),
    billDiscountAmount: z.number().min(0).max(1_000_000).optional(),
    couponCode: z.string().trim().min(3).max(40).optional(),
    redeemLoyaltyPoints: z.number().int().min(0).max(1_000_000).optional(),
    idempotencyKey: z.string().uuid(),
    sendToKitchen: z.boolean().optional().default(false),
    items: z.array(posOrderItemSchema).min(1).max(80),
  })
  .strict();
export type PlaceCaptainOrderInput = z.infer<typeof placeCaptainOrderSchema>;

export const kitchenItemPrepSchema = z
  .object({
    lineId: z.string().min(1),
    preparationStatus: z.enum(["QUEUED", "PREPARING", "READY"]),
  })
  .strict();
export type KitchenItemPrepInput = z.infer<typeof kitchenItemPrepSchema>;

export const openPosShiftSchema = z
  .object({
    openingFloat: z.number().min(0).max(1_000_000),
  })
  .strict();
export type OpenPosShiftInput = z.infer<typeof openPosShiftSchema>;

export const closePosShiftSchema = z
  .object({
    closingCashCounted: z.number().min(0).max(1_000_000),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();
export type ClosePosShiftInput = z.infer<typeof closePosShiftSchema>;

export const receiptReprintSchema = z
  .object({
    reason: z.string().trim().min(3).max(300).optional(),
  })
  .strict();
export type ReceiptReprintInput = z.infer<typeof receiptReprintSchema>;

const inventoryUnitSchema = z.enum(["g", "kg", "ml", "l", "pcs", "dozen"]);

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

export const upsertCustomerSchema = z
  .object({
    phone: z.string().trim().min(7).max(24),
    name: z.string().trim().max(120).optional(),
    email: z.string().trim().email().optional().or(z.literal("")),
    marketingOptIn: z.boolean().optional(),
    smsOptIn: z.boolean().optional(),
    emailOptIn: z.boolean().optional(),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const createCouponSchema = z
  .object({
    code: z.string().trim().min(3).max(40),
    description: z.string().trim().max(200).optional(),
    discountType: z.enum(["PERCENT", "FIXED"]),
    discountValue: z.number().positive(),
    minOrderTotal: z.number().min(0).optional(),
    maxRedemptions: z.number().int().min(1).optional(),
    pointsCost: z.number().int().min(0).optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
  })
  .strict();

export const customerFeedbackSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).optional(),
    customerId: z.string().optional(),
    orderId: z.string().optional(),
  })
  .strict();

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

export const deviceCommandSchema = z
  .object({
    name: z.enum([
      "PRINT",
      "OPEN_DRAWER",
      "CLOSE_DRAWER",
      "SCAN",
      "DISPLAY_UPDATE",
      "PAYMENT_REQUEST",
      "PAYMENT_CANCEL",
      "HEALTH_CHECK",
      "SIMULATE_PAPER_OUT",
      "SIMULATE_OFFLINE",
      "SIMULATE_RECOVER",
      "SIMULATE_PRINT_FAIL",
    ]),
    payload: z.record(z.string(), z.unknown()).optional(),
    timeoutMs: z.number().int().positive().max(30_000).optional(),
    idempotencyKey: z.string().max(120).optional(),
  })
  .strict();

export const registerSampleDevicesSchema = z
  .object({
    outletId: z.string().min(1).optional(),
  })
  .strict();

export const updateDeviceSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    kitchenStation: z.string().trim().min(1).max(40).optional(),
    printerRole: z
      .enum(["RECEIPT", "KITCHEN", "BAR", "SECONDARY_RECEIPT", "OTHER"])
      .optional(),
    outletId: z.string().min(1).optional(),
    configuration: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const registerPrinterSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    deviceType: z.enum(["RECEIPT_PRINTER", "KITCHEN_PRINTER"]),
    printerRole: z
      .enum(["RECEIPT", "KITCHEN", "BAR", "SECONDARY_RECEIPT", "OTHER"])
      .optional(),
    kitchenStation: z.string().trim().min(1).max(40).optional(),
    manufacturer: z.string().trim().max(80).optional(),
    model: z.string().trim().max(80).optional(),
    outletId: z.string().min(1).optional(),
    connectorId: z.string().min(1).optional(),
    configuration: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const assignDeviceConnectorSchema = z
  .object({
    connectorId: z.string().min(1),
    outletId: z.string().min(1).optional(),
  })
  .strict();

export const authorizedFallbackSchema = z
  .object({
    fallbackDeviceId: z.string().min(1),
    outletId: z.string().min(1).optional(),
  })
  .strict();
