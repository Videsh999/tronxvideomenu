import { z } from "zod";

export const createTableSchema = z.object({
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
  tableNumber: z.number().int().min(1),
  idempotencyKey: z.string().uuid(),
  items: z
    .array(
      z.object({
        dishId: z.string().min(1),
        variantId: z.string().min(1).optional(),
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
    idempotencyKey: z.string().trim().min(8).max(200),
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
    sendToKitchen: z.boolean().optional().default(true),
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
