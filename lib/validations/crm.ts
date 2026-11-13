import { z } from "zod";

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
