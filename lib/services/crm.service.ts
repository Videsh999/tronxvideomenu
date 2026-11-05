import { randomUUID } from "node:crypto";
import { crmRepository } from "@/lib/repositories/crm.repository";
import {
  applyCouponDiscount,
  earnPointsForOrder,
  loyaltyEarnKey,
} from "@/lib/crm/loyalty";
import type { Restaurant } from "@/types";

export class CrmServiceError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
  }
}

export class CrmService {
  listCustomers(restaurantId: string, query?: string) {
    return crmRepository.listCustomers(restaurantId, query);
  }

  async upsertCustomer(
    restaurantId: string,
    input: {
      phone: string;
      name?: string;
      email?: string;
      marketingOptIn?: boolean;
      smsOptIn?: boolean;
      emailOptIn?: boolean;
      notes?: string;
      organizationId?: string;
    },
  ) {
    const phone = input.phone.replace(/\s+/g, "").trim();
    if (phone.length < 7) throw new CrmServiceError("Enter a valid phone number.");
    const existing = await crmRepository.findByPhone(restaurantId, phone);
    return crmRepository.upsertCustomer({
      id: existing?.id ?? `cust-${randomUUID()}`,
      restaurantId,
      organizationId: input.organizationId ?? existing?.organizationId,
      phone,
      name: input.name ?? existing?.name,
      email: input.email ?? existing?.email,
      segment: existing?.segment ?? "NEW",
      loyaltyPoints: existing?.loyaltyPoints ?? 0,
      totalOrders: existing?.totalOrders ?? 0,
      totalSpend: existing?.totalSpend ?? 0,
      marketingOptIn: input.marketingOptIn ?? existing?.marketingOptIn ?? false,
      smsOptIn: input.smsOptIn ?? existing?.smsOptIn ?? false,
      emailOptIn: input.emailOptIn ?? existing?.emailOptIn ?? false,
      lastOrderAt: existing?.lastOrderAt,
      notes: input.notes ?? existing?.notes,
    });
  }

  listCoupons(restaurantId: string) {
    return crmRepository.listCoupons(restaurantId);
  }

  createCoupon(
    restaurantId: string,
    input: {
      code: string;
      description?: string;
      discountType: "PERCENT" | "FIXED";
      discountValue: number;
      minOrderTotal?: number;
      maxRedemptions?: number;
      pointsCost?: number;
      startsAt?: string;
      endsAt?: string;
    },
  ) {
    return crmRepository.createCoupon({
      id: `coupon-${randomUUID()}`,
      restaurantId,
      code: input.code.trim().toUpperCase(),
      description: input.description,
      discountType: input.discountType,
      discountValue: input.discountValue,
      minOrderTotal: input.minOrderTotal,
      maxRedemptions: input.maxRedemptions,
      redemptionCount: 0,
      pointsCost: input.pointsCost,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      isActive: true,
    });
  }

  async previewCoupon(restaurantId: string, code: string, orderTotal: number) {
    const coupon = await crmRepository.getCouponByCode(restaurantId, code);
    if (!coupon || !coupon.isActive) throw new CrmServiceError("Coupon not found.", 404);
    if (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions) {
      throw new CrmServiceError("Coupon redemption limit reached.", 409);
    }
    const now = Date.now();
    if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
      throw new CrmServiceError("Coupon is not active yet.");
    }
    if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) {
      throw new CrmServiceError("Coupon has expired.");
    }
    const result = applyCouponDiscount({
      orderTotal,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      minOrderTotal: coupon.minOrderTotal,
    });
    return { coupon, ...result };
  }

  async redeemCoupon(restaurantId: string, code: string, orderTotal: number) {
    const preview = await this.previewCoupon(restaurantId, code, orderTotal);
    const reserved = await this.reserveCouponRedemption({
      restaurantId,
      code,
      orderTotal,
      orderId: `legacy-${Date.now()}`,
      idempotencyKey: `legacy-redeem:${preview.coupon.id}:${Date.now()}`,
    });
    if (!reserved.ok) {
      throw new CrmServiceError(
        reserved.reason === "LIMIT_REACHED"
          ? "Coupon redemption limit reached."
          : "Coupon not found.",
        reserved.reason === "LIMIT_REACHED" ? 409 : 404,
      );
    }
    await crmRepository.confirmCouponRedemption(
      restaurantId,
      reserved.redemption.idempotencyKey,
    );
    return preview;
  }

  /**
   * Atomically reserve a coupon under maxRedemptions.
   * Caller must confirm after durable order create, or release on failure.
   */
  async reserveCouponRedemption(params: {
    restaurantId: string;
    code: string;
    orderTotal: number;
    orderId: string;
    customerId?: string;
    idempotencyKey: string;
  }) {
    const preview = await this.previewCoupon(params.restaurantId, params.code, params.orderTotal);
    const result = await crmRepository.atomicReserveCouponRedemption({
      restaurantId: params.restaurantId,
      couponId: preview.coupon.id,
      orderId: params.orderId,
      customerId: params.customerId,
      idempotencyKey: params.idempotencyKey,
      discountAmount: preview.discount,
      codeSnapshot: preview.coupon.code,
    });
    if (!result.ok) {
      return { ok: false as const, reason: result.reason, preview };
    }
    return {
      ok: true as const,
      preview,
      coupon: result.coupon,
      redemption: result.redemption,
      duplicate: result.duplicate,
    };
  }

  confirmCouponRedemption(restaurantId: string, idempotencyKey: string) {
    return crmRepository.confirmCouponRedemption(restaurantId, idempotencyKey);
  }

  releaseCouponRedemption(restaurantId: string, idempotencyKey: string) {
    return crmRepository.releaseCouponRedemption(restaurantId, idempotencyKey);
  }

  /**
   * Idempotent loyalty earn when an order is completed/paid.
   */
  async earnForOrder(
    restaurant: Restaurant,
    customerId: string,
    orderId: string,
    orderTotal: number,
  ) {
    if (restaurant.loyaltySettings?.enabled === false) {
      return { skipped: true as const, reason: "Loyalty disabled." };
    }
    const points = earnPointsForOrder({
      orderTotal,
      pointsPerCurrencyUnit: restaurant.loyaltySettings?.pointsPerCurrencyUnit,
    });
    if (points <= 0) return { skipped: true as const, reason: "No points to earn." };

    const result = await crmRepository.applyLoyalty({
      restaurantId: restaurant.id,
      customerId,
      kind: "EARN",
      points,
      orderId,
      idempotencyKey: loyaltyEarnKey(orderId),
      note: `Earned from order ${orderId}`,
    });
    return { skipped: false as const, ...result };
  }

  createFeedback(
    restaurantId: string,
    input: { rating: number; comment?: string; customerId?: string; orderId?: string },
  ) {
    if (input.rating < 1 || input.rating > 5) {
      throw new CrmServiceError("Rating must be between 1 and 5.");
    }
    return crmRepository.createFeedback({
      id: `fb-${randomUUID()}`,
      restaurantId,
      customerId: input.customerId,
      orderId: input.orderId,
      rating: input.rating,
      comment: input.comment,
      createdAt: new Date().toISOString(),
    });
  }

  listFeedback(restaurantId: string) {
    return crmRepository.listFeedback(restaurantId);
  }
}

export const crmService = new CrmService();
