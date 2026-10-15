import type { RestaurantOrder } from "@/types";
import type { IOrderRepository } from "./types";
import { connectToDatabase } from "@/lib/db/mongodb";
import { OrderCounterModel, OrderModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";

export class OrderRepository implements IOrderRepository {
  async create(data: Omit<RestaurantOrder, "orderNumber" | "createdAt" | "updatedAt">) {
    await connectToDatabase();
    const now = new Date().toISOString();
    try {
      await OrderCounterModel.updateOne(
        { restaurantId: data.restaurantId },
        { $setOnInsert: { restaurantId: data.restaurantId, value: 1000 } },
        { upsert: true },
      );
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
    }
    const counter = await OrderCounterModel.findOneAndUpdate(
      { restaurantId: data.restaurantId },
      { $inc: { value: 1 } },
      { new: true },
    ).lean();
    const created = await OrderModel.create({
      ...data,
      orderNumber: Number(counter?.value ?? 1001),
      createdAt: now,
      updatedAt: now,
    });
    return this.mapOrder(created.toObject());
  }

  async findByRestaurantId(restaurantId: string) {
    await connectToDatabase();
    const orders = await OrderModel.find({ restaurantId }).sort({ createdAt: -1 }).lean();
    return orders.map((order) => this.mapOrder(order));
  }

  async findByRestaurantAndId(restaurantId: string, id: string) {
    await connectToDatabase();
    const order = await OrderModel.findOne({ restaurantId, id }).lean();
    return order ? this.mapOrder(order) : null;
  }

  async findForCustomer(id: string) {
    await connectToDatabase();
    const order = await OrderModel.findOne({ id }).select("+customerTokenHash").lean();
    return order ? this.mapOrder(order) : null;
  }

  async updateStatus(restaurantId: string, id: string, expectedStatus: RestaurantOrder["status"], status: RestaurantOrder["status"]) {
    await connectToDatabase();
    const order = await OrderModel.findOneAndUpdate(
      { restaurantId, id, status: expectedStatus },
      { $set: { status, updatedAt: new Date().toISOString() } },
      { new: true, runValidators: true },
    ).lean();
    return order ? this.mapOrder(order) : null;
  }

  async revertAcceptance(restaurantId: string, id: string) {
    await connectToDatabase();
    const order = await OrderModel.findOneAndUpdate(
      { restaurantId, id, status: "ACCEPTED" },
      { $set: { status: "PENDING", updatedAt: new Date().toISOString() } },
      { new: true, runValidators: true },
    ).lean();
    return order ? this.mapOrder(order) : null;
  }

  async recordPayment(
    restaurantId: string,
    id: string,
    method: import("@/types").PaymentMethod,
    amount: number,
    actor: import("@/types").PaymentAuditActor,
    event: import("@/types").PaymentAuditEvent,
  ) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const order = await OrderModel.findOneAndUpdate(
      {
        restaurantId,
        id,
        status: { $ne: "CANCELLED" },
        $or: [
          { "payment.status": { $in: ["UNPAID", "NOT_RECORDED"] } },
          { payment: { $exists: false } },
        ],
      },
      {
        $set: {
          "payment.status": "PAID",
          "payment.method": method,
          "payment.amount": amount,
          "payment.recordedAt": now,
          "payment.recordedBy": actor,
          updatedAt: now,
        },
        $push: {
          "payment.auditTrail": event,
        },
      },
      { new: true, runValidators: true },
    ).lean();
    return order ? this.mapOrder(order) : null;
  }

  async correctPayment(
    restaurantId: string,
    id: string,
    newStatus: import("@/types").PaymentStatus,
    newMethod: import("@/types").PaymentMethod | undefined,
    event: import("@/types").PaymentAuditEvent,
  ) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const updateSet: Record<string, unknown> = {
      "payment.status": newStatus,
      updatedAt: now,
    };
    if (newStatus === "PAID") {
      updateSet["payment.method"] = newMethod;
      updateSet["payment.recordedAt"] = now;
      updateSet["payment.recordedBy"] = event.actor;
    } else {
      updateSet["payment.method"] = null;
      updateSet["payment.recordedAt"] = null;
      updateSet["payment.recordedBy"] = null;
    }

    const order = await OrderModel.findOneAndUpdate(
      {
        restaurantId,
        id,
        "payment.status": "PAID",
        status: { $ne: "CANCELLED" },
      },
      {
        $set: updateSet,
        $push: {
          "payment.auditTrail": event,
        },
      },
      { new: true, runValidators: true },
    ).lean();
    return order ? this.mapOrder(order) : null;
  }

  private mapOrder(order: unknown): RestaurantOrder {
    const domain = toDomain<RestaurantOrder>(order);
    if (!domain.payment || !domain.payment.status) {
      domain.payment = {
        status: "NOT_RECORDED",
        auditTrail: [],
      };
    }
    return domain;
  }

  async hasIdempotencyKey(restaurantId: string, key: string) {
    await connectToDatabase();
    return Boolean(await OrderModel.exists({ restaurantId, idempotencyKey: key }));
  }
}

export const orderRepository = new OrderRepository();
