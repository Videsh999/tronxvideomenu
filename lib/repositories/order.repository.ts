import type { RestaurantOrder, KitchenStation, OrderEvent } from "@/types";
import type { IOrderRepository } from "./types";
import { connectToDatabase } from "@/lib/db/mongodb";
import { OrderCounterModel, OrderModel, ReceiptReprintLogModel } from "@/lib/db/models";
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

  async findKitchenActive(restaurantId: string, station?: KitchenStation) {
    await connectToDatabase();
    const statuses = ["PENDING", "ACCEPTED", "PREPARING", "READY"];
    const orders = await OrderModel.find({
      restaurantId,
      status: { $in: statuses },
    })
      .sort({ createdAt: 1 })
      .lean();
    const mapped = orders.map((order) => this.mapOrder(order));
    if (!station) return mapped;
    return mapped
      .map((order) => ({
        ...order,
        items: order.items.filter(
          (item) => (item.kitchenStation ?? "MAIN") === station,
        ),
      }))
      .filter((order) => order.items.length > 0);
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

  async updateStatus(
    restaurantId: string,
    id: string,
    expectedStatus: RestaurantOrder["status"],
    status: RestaurantOrder["status"],
    event?: OrderEvent,
  ) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const set: Record<string, unknown> = { status, updatedAt: now };
    if (status === "COMPLETED" || status === "SERVED") {
      set.completedAt = now;
    }
    const update: Record<string, unknown> = { $set: set };
    if (event) {
      update.$push = { events: event };
    }
    const order = await OrderModel.findOneAndUpdate(
      { restaurantId, id, status: expectedStatus },
      update,
      { new: true, runValidators: true },
    ).lean();
    return order ? this.mapOrder(order) : null;
  }

  async appendEvent(restaurantId: string, id: string, event: OrderEvent) {
    await connectToDatabase();
    const order = await OrderModel.findOneAndUpdate(
      { restaurantId, id },
      {
        $push: { events: event },
        $set: { updatedAt: new Date().toISOString() },
      },
      { new: true, runValidators: true },
    ).lean();
    return order ? this.mapOrder(order) : null;
  }

  async updateItemPreparation(
    restaurantId: string,
    id: string,
    lineId: string,
    preparationStatus: "QUEUED" | "PREPARING" | "READY",
    event: OrderEvent,
  ) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const order = await OrderModel.findOneAndUpdate(
      { restaurantId, id, "items.lineId": lineId },
      {
        $set: {
          "items.$.preparationStatus": preparationStatus,
          updatedAt: now,
        },
        $push: { events: event },
      },
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
    options?: {
      paymentStatus: import("@/types").PaymentStatus;
      amountPaid: number;
      ledgerEntry?: import("@/types").PaymentLedgerEntry;
      orderEvent?: OrderEvent;
    },
  ) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const paymentStatus = options?.paymentStatus ?? "PAID";
    const amountPaid = options?.amountPaid ?? amount;
    const push: Record<string, unknown> = {
      "payment.auditTrail": event,
    };
    if (options?.ledgerEntry) {
      push["payment.ledger"] = options.ledgerEntry;
    }
    if (options?.orderEvent) {
      push.events = options.orderEvent;
    }

    const filter: Record<string, unknown> = {
      restaurantId,
      id,
      status: { $nin: ["CANCELLED", "REJECTED"] },
    };
    if (paymentStatus === "PAID" && !options) {
      filter.$or = [
        { "payment.status": { $in: ["UNPAID", "NOT_RECORDED", "PARTIAL"] } },
        { payment: { $exists: false } },
      ];
    } else {
      filter["payment.status"] = { $in: ["UNPAID", "NOT_RECORDED", "PARTIAL"] };
    }

    const order = await OrderModel.findOneAndUpdate(
      filter,
      {
        $set: {
          "payment.status": paymentStatus,
          "payment.method": method,
          "payment.amount": amount,
          "payment.amountPaid": amountPaid,
          "payment.recordedAt": now,
          "payment.recordedBy": actor,
          updatedAt: now,
        },
        $push: push,
      },
      { new: true, runValidators: true },
    ).lean();
    return order ? this.mapOrder(order) : null;
  }

  async applyRefund(
    restaurantId: string,
    id: string,
    paymentStatus: import("@/types").PaymentStatus,
    amountPaid: number,
    auditEvent: import("@/types").PaymentAuditEvent,
    ledgerEntry: import("@/types").PaymentLedgerEntry,
    orderEvent: OrderEvent,
    orderStatus?: RestaurantOrder["status"],
  ) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const set: Record<string, unknown> = {
      "payment.status": paymentStatus,
      "payment.amountPaid": amountPaid,
      updatedAt: now,
    };
    if (orderStatus) set.status = orderStatus;

    const order = await OrderModel.findOneAndUpdate(
      {
        restaurantId,
        id,
        "payment.status": { $in: ["PAID", "PARTIAL"] },
        status: { $nin: ["CANCELLED", "REJECTED", "REFUNDED"] },
      },
      {
        $set: set,
        $push: {
          "payment.auditTrail": auditEvent,
          "payment.ledger": ledgerEntry,
          events: orderEvent,
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
      updateSet["payment.amountPaid"] = 0;
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

  async logReceiptReprint(entry: {
    id: string;
    restaurantId: string;
    orderId: string;
    orderNumber: number;
    reprintedAt: string;
    reprintedBy: import("@/types").PaymentAuditActor;
    reason?: string;
  }) {
    await connectToDatabase();
    await ReceiptReprintLogModel.create(entry);
  }

  private mapOrder(order: unknown): RestaurantOrder {
    const domain = toDomain<RestaurantOrder>(order);
    if (!domain.payment || !domain.payment.status) {
      domain.payment = {
        status: "NOT_RECORDED",
        auditTrail: [],
        ledger: [],
        amountPaid: 0,
      };
    }
    if (!domain.events) domain.events = [];
    if (!domain.channel) domain.channel = "QR";
    if (!domain.source) domain.source = "QR";
    return domain;
  }

  async replaceItemsAndTotals(
    restaurantId: string,
    id: string,
    patch: {
      items: RestaurantOrder["items"];
      subtotal: number;
      taxRatePercent?: number;
      taxAmount: number;
      packagingCharge?: number;
      serviceCharge?: number;
      cgstAmount?: number;
      sgstAmount?: number;
      igstAmount?: number;
      billSnapshot?: RestaurantOrder["billSnapshot"];
      total: number;
      orderNote?: string;
      event: OrderEvent;
      reopenForKitchen?: boolean;
      billDiscountAmount?: number;
    },
  ) {
    await connectToDatabase();
    const set: Record<string, unknown> = {
      items: patch.items,
      subtotal: patch.subtotal,
      taxAmount: patch.taxAmount,
      total: patch.total,
      updatedAt: new Date().toISOString(),
    };
    if (patch.taxRatePercent !== undefined) set.taxRatePercent = patch.taxRatePercent;
    if (patch.packagingCharge !== undefined) set.packagingCharge = patch.packagingCharge;
    if (patch.serviceCharge !== undefined) set.serviceCharge = patch.serviceCharge;
    if (patch.cgstAmount !== undefined) set.cgstAmount = patch.cgstAmount;
    if (patch.sgstAmount !== undefined) set.sgstAmount = patch.sgstAmount;
    if (patch.igstAmount !== undefined) set.igstAmount = patch.igstAmount;
    if (patch.billSnapshot !== undefined) set.billSnapshot = patch.billSnapshot;
    if (patch.orderNote !== undefined) set.orderNote = patch.orderNote;
    if (patch.billDiscountAmount !== undefined) set.billDiscountAmount = patch.billDiscountAmount;
    if (patch.reopenForKitchen) set.status = "PREPARING";

    const order = await OrderModel.findOneAndUpdate(
      { restaurantId, id, status: { $nin: ["CANCELLED", "REJECTED", "REFUNDED", "COMPLETED"] } },
      {
        $set: set,
        $push: { events: patch.event },
      },
      { new: true, runValidators: true },
    ).lean();
    return order ? this.mapOrder(order) : null;
  }

  async hasIdempotencyKey(restaurantId: string, key: string) {
    await connectToDatabase();
    return Boolean(await OrderModel.exists({ restaurantId, idempotencyKey: key }));
  }

  async findByIdempotencyKey(restaurantId: string, key: string) {
    await connectToDatabase();
    const order = await OrderModel.findOne({ restaurantId, idempotencyKey: key }).lean();
    return order ? this.mapOrder(order) : null;
  }
}

export const orderRepository = new OrderRepository();
