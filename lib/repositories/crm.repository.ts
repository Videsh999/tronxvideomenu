import { randomUUID } from "node:crypto";
import {
  CouponModel,
  CouponRedemptionModel,
  CustomerFeedbackModel,
  CustomerProfileModel,
  LoyaltyTransactionModel,
} from "@/lib/db/models";
import { connectToDatabase } from "@/lib/db/mongodb";
import { toDomain } from "@/lib/db/mongo-mappers";
import type {
  Coupon,
  CouponRedemption,
  CustomerFeedback,
  CustomerProfile,
  LoyaltyTransaction,
} from "@/types";

export class CrmRepository {
  async listCustomers(restaurantId: string, query?: string): Promise<CustomerProfile[]> {
    await connectToDatabase();
    const filter: Record<string, unknown> = { restaurantId };
    if (query?.trim()) {
      const q = query.trim();
      filter.$or = [
        { phone: { $regex: q, $options: "i" } },
        { name: { $regex: q, $options: "i" } },
        { email: { $regex: q, $options: "i" } },
      ];
    }
    const rows = await CustomerProfileModel.find(filter).sort({ updatedAt: -1 }).limit(100).lean();
    return rows.map((row) => toDomain<CustomerProfile>(row));
  }

  async getCustomer(restaurantId: string, id: string): Promise<CustomerProfile | null> {
    await connectToDatabase();
    const row = await CustomerProfileModel.findOne({ restaurantId, id }).lean();
    return row ? toDomain<CustomerProfile>(row) : null;
  }

  async findByPhone(restaurantId: string, phone: string): Promise<CustomerProfile | null> {
    await connectToDatabase();
    const row = await CustomerProfileModel.findOne({ restaurantId, phone }).lean();
    return row ? toDomain<CustomerProfile>(row) : null;
  }

  async upsertCustomer(
    data: Omit<CustomerProfile, "createdAt" | "updatedAt"> &
      Partial<Pick<CustomerProfile, "createdAt" | "updatedAt">>,
  ): Promise<CustomerProfile> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const updated = await CustomerProfileModel.findOneAndUpdate(
      { restaurantId: data.restaurantId, phone: data.phone },
      {
        $set: { ...data, updatedAt: now },
        $setOnInsert: { createdAt: data.createdAt ?? now },
      },
      { upsert: true, new: true },
    ).lean();
    return toDomain<CustomerProfile>(updated!);
  }

  async findLoyaltyByKey(
    restaurantId: string,
    idempotencyKey: string,
  ): Promise<LoyaltyTransaction | null> {
    await connectToDatabase();
    const row = await LoyaltyTransactionModel.findOne({ restaurantId, idempotencyKey }).lean();
    return row ? toDomain<LoyaltyTransaction>(row) : null;
  }

  /**
   * Idempotent loyalty ledger write.
   * REDEEM uses atomic $inc with loyaltyPoints >= points so concurrent
   * redemptions cannot drive the balance negative.
   */
  async applyLoyalty(params: {
    restaurantId: string;
    customerId: string;
    kind: LoyaltyTransaction["kind"];
    points: number;
    orderId?: string;
    couponId?: string;
    idempotencyKey: string;
    note?: string;
  }): Promise<{ customer: CustomerProfile; transaction: LoyaltyTransaction }> {
    await connectToDatabase();
    const existing = await this.findLoyaltyByKey(params.restaurantId, params.idempotencyKey);
    if (existing) {
      const customer = await this.getCustomer(params.restaurantId, params.customerId);
      if (!customer) throw new Error("Customer not found.");
      return { customer, transaction: existing };
    }

    const absPoints = Math.abs(params.points);
    const delta =
      params.kind === "EARN" || params.kind === "ADJUST" ? absPoints : -absPoints;
    const now = new Date().toISOString();
    const txId = `loy-${params.idempotencyKey}`;

    const filter: Record<string, unknown> = {
      restaurantId: params.restaurantId,
      id: params.customerId,
    };
    if (delta < 0) {
      filter.loyaltyPoints = { $gte: absPoints };
    }

    const updatedCustomer = await CustomerProfileModel.findOneAndUpdate(
      filter,
      {
        $inc: { loyaltyPoints: delta },
        $set: { updatedAt: now },
      },
      { new: true },
    ).lean();

    if (!updatedCustomer) {
      const stillThere = await this.getCustomer(params.restaurantId, params.customerId);
      if (!stillThere) throw new Error("Customer not found.");
      throw new Error("Insufficient loyalty points.");
    }

    try {
      await LoyaltyTransactionModel.create({
        id: txId,
        restaurantId: params.restaurantId,
        customerId: params.customerId,
        kind: params.kind,
        points: absPoints,
        balanceAfter: updatedCustomer.loyaltyPoints,
        orderId: params.orderId,
        couponId: params.couponId,
        idempotencyKey: params.idempotencyKey,
        note: params.note,
        createdAt: now,
      });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) {
        // Duplicate idempotency — compensate the balance change we just applied.
        await CustomerProfileModel.updateOne(
          { restaurantId: params.restaurantId, id: params.customerId },
          { $inc: { loyaltyPoints: -delta }, $set: { updatedAt: new Date().toISOString() } },
        );
        const again = await this.findLoyaltyByKey(params.restaurantId, params.idempotencyKey);
        const cust = await this.getCustomer(params.restaurantId, params.customerId);
        if (again && cust) return { customer: cust, transaction: again };
      } else {
        await CustomerProfileModel.updateOne(
          { restaurantId: params.restaurantId, id: params.customerId },
          { $inc: { loyaltyPoints: -delta }, $set: { updatedAt: new Date().toISOString() } },
        );
      }
      throw error;
    }

    const transaction = await LoyaltyTransactionModel.findOne({ id: txId }).lean();
    return {
      customer: toDomain<CustomerProfile>(updatedCustomer),
      transaction: toDomain<LoyaltyTransaction>(transaction!),
    };
  }

  async listCoupons(restaurantId: string): Promise<Coupon[]> {
    await connectToDatabase();
    const rows = await CouponModel.find({ restaurantId }).sort({ createdAt: -1 }).lean();
    return rows.map((row) => toDomain<Coupon>(row));
  }

  async createCoupon(data: Omit<Coupon, "createdAt" | "updatedAt">): Promise<Coupon> {
    await connectToDatabase();
    const now = new Date().toISOString();
    const created = await CouponModel.create({ ...data, createdAt: now, updatedAt: now });
    return toDomain<Coupon>(created.toObject());
  }

  async getCouponByCode(restaurantId: string, code: string): Promise<Coupon | null> {
    await connectToDatabase();
    const row = await CouponModel.findOne({
      restaurantId,
      code: code.toUpperCase(),
    }).lean();
    return row ? toDomain<Coupon>(row) : null;
  }

  async getCouponById(restaurantId: string, id: string): Promise<Coupon | null> {
    await connectToDatabase();
    const row = await CouponModel.findOne({ restaurantId, id }).lean();
    return row ? toDomain<Coupon>(row) : null;
  }

  async incrementCouponRedemption(restaurantId: string, id: string): Promise<Coupon | null> {
    const result = await this.atomicReserveCouponRedemption({
      restaurantId,
      couponId: id,
      orderId: `legacy-${randomUUID()}`,
      idempotencyKey: `legacy-${randomUUID()}`,
      discountAmount: 0,
      codeSnapshot: "",
    });
    return result.ok ? result.coupon : null;
  }

  /**
   * Atomically reserve a coupon redemption under maxRedemptions.
   * Concurrent callers beyond the limit receive ok:false.
   * Idempotent on (restaurantId, idempotencyKey).
   */
  async atomicReserveCouponRedemption(params: {
    restaurantId: string;
    couponId: string;
    orderId: string;
    customerId?: string;
    idempotencyKey: string;
    discountAmount: number;
    codeSnapshot: string;
  }): Promise<
    | { ok: true; coupon: Coupon; redemption: CouponRedemption; duplicate: boolean }
    | { ok: false; reason: "LIMIT_REACHED" | "NOT_FOUND" }
  > {
    await connectToDatabase();
    const existing = await CouponRedemptionModel.findOne({
      restaurantId: params.restaurantId,
      idempotencyKey: params.idempotencyKey,
    }).lean();
    if (existing) {
      const coupon = await this.getCouponById(params.restaurantId, params.couponId);
      if (!coupon) return { ok: false, reason: "NOT_FOUND" };
      return {
        ok: true,
        coupon,
        redemption: toDomain<CouponRedemption>(existing),
        duplicate: true,
      };
    }

    const now = new Date().toISOString();
    const coupon = await CouponModel.findOneAndUpdate(
      {
        restaurantId: params.restaurantId,
        id: params.couponId,
        isActive: true,
        $or: [
          { maxRedemptions: { $exists: false } },
          { maxRedemptions: null },
          { $expr: { $lt: ["$redemptionCount", "$maxRedemptions"] } },
        ],
      },
      {
        $inc: { redemptionCount: 1 },
        $set: { updatedAt: now },
      },
      { new: true },
    ).lean();

    if (!coupon) {
      const stillThere = await CouponModel.findOne({
        restaurantId: params.restaurantId,
        id: params.couponId,
      }).lean();
      return { ok: false, reason: stillThere ? "LIMIT_REACHED" : "NOT_FOUND" };
    }

    try {
      const created = await CouponRedemptionModel.create({
        id: `credeem-${randomUUID()}`,
        restaurantId: params.restaurantId,
        couponId: params.couponId,
        orderId: params.orderId,
        customerId: params.customerId,
        idempotencyKey: params.idempotencyKey,
        status: "RESERVED",
        discountAmount: params.discountAmount,
        codeSnapshot: params.codeSnapshot,
        createdAt: now,
        updatedAt: now,
      });
      return {
        ok: true,
        coupon: toDomain<Coupon>(coupon),
        redemption: toDomain<CouponRedemption>(created.toObject()),
        duplicate: false,
      };
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === 11000) {
        const winner = await CouponRedemptionModel.findOne({
          restaurantId: params.restaurantId,
          idempotencyKey: params.idempotencyKey,
        }).lean();
        if (winner) {
          await CouponModel.updateOne(
            { restaurantId: params.restaurantId, id: params.couponId },
            { $inc: { redemptionCount: -1 }, $set: { updatedAt: new Date().toISOString() } },
          );
          return {
            ok: true,
            coupon: toDomain<Coupon>(coupon),
            redemption: toDomain<CouponRedemption>(winner),
            duplicate: true,
          };
        }
      }
      await CouponModel.updateOne(
        { restaurantId: params.restaurantId, id: params.couponId },
        { $inc: { redemptionCount: -1 }, $set: { updatedAt: new Date().toISOString() } },
      );
      throw error;
    }
  }

  async confirmCouponRedemption(restaurantId: string, idempotencyKey: string) {
    await connectToDatabase();
    await CouponRedemptionModel.updateOne(
      { restaurantId, idempotencyKey, status: "RESERVED" },
      { $set: { status: "CONFIRMED", updatedAt: new Date().toISOString() } },
    );
  }

  async releaseCouponRedemption(restaurantId: string, idempotencyKey: string) {
    await connectToDatabase();
    const redemption = await CouponRedemptionModel.findOneAndUpdate(
      { restaurantId, idempotencyKey, status: { $in: ["RESERVED", "CONFIRMED"] } },
      { $set: { status: "RELEASED", updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();
    if (!redemption) return null;
    await CouponModel.updateOne(
      { restaurantId, id: redemption.couponId },
      { $inc: { redemptionCount: -1 }, $set: { updatedAt: new Date().toISOString() } },
    );
    return toDomain<CouponRedemption>(redemption);
  }

  async createFeedback(
    data: Omit<CustomerFeedback, "createdAt"> & Partial<Pick<CustomerFeedback, "createdAt">>,
  ): Promise<CustomerFeedback> {
    await connectToDatabase();
    const created = await CustomerFeedbackModel.create({
      ...data,
      createdAt: data.createdAt ?? new Date().toISOString(),
    });
    return toDomain<CustomerFeedback>(created.toObject());
  }

  async listFeedback(restaurantId: string): Promise<CustomerFeedback[]> {
    await connectToDatabase();
    const rows = await CustomerFeedbackModel.find({ restaurantId }).sort({ createdAt: -1 }).lean();
    return rows.map((row) => toDomain<CustomerFeedback>(row));
  }
}

export const crmRepository = new CrmRepository();
