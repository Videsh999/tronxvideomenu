import type { ClientSession } from "mongoose";
import type { RestaurantOrder, KitchenStation, OrderEvent } from "@/types";
import type { IOrderRepository } from "./types";
import { connectToDatabase } from "@/lib/db/mongodb";
import { OrderCounterModel, OrderModel, ReceiptReprintLogModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";

function versionClause(expectedVersion: number): Record<string, unknown> {
  if (expectedVersion === 0) {
    return { $or: [{ version: 0 }, { version: { $exists: false } }, { version: null }] };
  }
  return { version: expectedVersion };
}

function amountPaidClause(expectedAmountPaid: number): Record<string, unknown> {
  if (expectedAmountPaid === 0) {
    return {
      $or: [
        { "payment.amountPaid": 0 },
        { "payment.amountPaid": { $exists: false } },
        { "payment.amountPaid": null },
      ],
    };
  }
  return { "payment.amountPaid": expectedAmountPaid };
}

export class OrderRepository implements IOrderRepository {
  async create(data: Omit<RestaurantOrder, "orderNumber" | "createdAt" | "updatedAt">, session?: ClientSession) {
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
    const doc = {
      ...data,
      orderNumber: Number(counter?.value ?? 1001),
      createdAt: now,
      updatedAt: now,
    };
    const created = session
      ? (await OrderModel.create([doc], { session }))[0]!
      : await OrderModel.create(doc);
    return this.mapOrder(created.toObject());
  }

  async findByRestaurantId(restaurantId: string) {
    await connectToDatabase();
    const orders = await OrderModel.find({ restaurantId }).sort({ createdAt: -1 }).lean();
    return orders.map((order) => this.mapOrder(order));
  }

  /**
   * Live floor window: every open order plus recently created ones.
   * Avoids loading full order history on every screen / poll.
   */
  async findOperational(restaurantId: string, options?: { sinceHours?: number; limit?: number }) {
    await connectToDatabase();
    const since = new Date(Date.now() - (options?.sinceHours ?? 36) * 60 * 60 * 1000).toISOString();
    const orders = await OrderModel.find({
      restaurantId,
      $or: [
        { status: { $in: ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED"] } },
        { createdAt: { $gte: since } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(options?.limit ?? 400)
      .lean();
    return orders.map((order) => this.mapOrder(order));
  }

  async findPending(restaurantId: string, tableNumbers?: number[]) {
    await connectToDatabase();
    const filter: Record<string, unknown> = { restaurantId, status: "PENDING" };
    if (tableNumbers && tableNumbers.length > 0) filter.tableNumber = { $in: tableNumbers };
    const orders = await OrderModel.find(filter).sort({ createdAt: -1 }).limit(200).lean();
    return orders.map((order) => this.mapOrder(order));
  }

  async findRunningForTable(restaurantId: string, tableNumber: number, session?: ClientSession) {
    await connectToDatabase();
    const orders = await OrderModel.find({
      restaurantId,
      tableNumber,
      status: { $in: ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED"] },
    })
      .session(session ?? null)
      .sort({ createdAt: 1 })
      .lean();
    return orders.map((order) => this.mapOrder(order));
  }

  async appendVersionedEvent(
    restaurantId: string,
    id: string,
    event: OrderEvent,
    expectedVersion: number,
    session?: ClientSession,
  ) {
    await connectToDatabase();
    const order = await OrderModel.findOneAndUpdate(
      { $and: [{ restaurantId, id }, versionClause(expectedVersion)] },
      {
        $set: { version: expectedVersion + 1, updatedAt: new Date().toISOString() },
        $push: { events: event },
      },
      { new: true, runValidators: true, session },
    ).lean();
    return order ? this.mapOrder(order) : null;
  }

  async findByFloorActionKey(restaurantId: string, key: string) {
    await connectToDatabase();
    const order = await OrderModel.findOne({
      restaurantId,
      "events.meta.floorActionKey": key,
    }).lean();
    return order ? this.mapOrder(order) : null;
  }

  async relocate(
    restaurantId: string,
    id: string,
    table: { tableId: string; tableNumber: number },
    event: OrderEvent,
    expectedVersion: number,
    session?: ClientSession,
  ) {
    await connectToDatabase();
    const order = await OrderModel.findOneAndUpdate(
      { $and: [{ restaurantId, id }, versionClause(expectedVersion)] },
      {
        $set: {
          tableId: table.tableId,
          tableNumber: table.tableNumber,
          version: expectedVersion + 1,
          updatedAt: new Date().toISOString(),
        },
        $push: { events: event },
      },
      { new: true, runValidators: true, session },
    ).lean();
    return order ? this.mapOrder(order) : null;
  }

  async findActiveForTable(restaurantId: string, tableNumber: number) {
    await connectToDatabase();
    const order = await OrderModel.findOne({
      restaurantId,
      tableNumber,
      status: { $in: ["PENDING", "ACCEPTED", "PREPARING", "READY"] },
    })
      .sort({ createdAt: -1 })
      .lean();
    return order ? this.mapOrder(order) : null;
  }

  async findKitchenActive(restaurantId: string, station?: KitchenStation) {
    await connectToDatabase();
    // PENDING stays off KDS until Accept. SERVED stays briefly for the Served column.
    const servedSince = new Date(Date.now() - 1000 * 60 * 90).toISOString();
    const orders = await OrderModel.find({
      restaurantId,
      $or: [
        { status: { $in: ["ACCEPTED", "PREPARING", "READY"] } },
        { status: "SERVED", updatedAt: { $gte: servedSince } },
      ],
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

  async findByRestaurantAndId(restaurantId: string, id: string, session?: ClientSession) {
    await connectToDatabase();
    const order = await OrderModel.findOne({ restaurantId, id }).session(session ?? null).lean();
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
    expectedVersion?: number,
    session?: ClientSession,
  ) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const set: Record<string, unknown> = { status, updatedAt: now };
    if (expectedVersion != null) set.version = expectedVersion + 1;
    if (status === "COMPLETED" || status === "SERVED") {
      set.completedAt = now;
    }
    const update: Record<string, unknown> = { $set: set };
    if (event) {
      update.$push = { events: event };
    }
    const filter: Record<string, unknown> = expectedVersion == null
      ? { restaurantId, id, status: expectedStatus }
      : { $and: [{ restaurantId, id, status: expectedStatus }, versionClause(expectedVersion)] };
    const order = await OrderModel.findOneAndUpdate(
      filter,
      update,
      { new: true, runValidators: true, session },
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
    expectedVersion: number,
  ) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const order = await OrderModel.findOneAndUpdate(
      {
        $and: [
          { restaurantId, id, "items.lineId": lineId },
          versionClause(expectedVersion),
        ],
      },
      {
        $set: {
          "items.$.preparationStatus": preparationStatus,
          version: expectedVersion + 1,
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
      expectedVersion?: number;
      expectedAmountPaid?: number;
      idempotencyKey?: string;
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

    const clauses: Record<string, unknown>[] = [
      {
        restaurantId,
        id,
        status: { $nin: ["CANCELLED", "REJECTED", "REFUNDED"] },
        "payment.status": { $in: ["UNPAID", "NOT_RECORDED", "PARTIAL"] },
      },
    ];
    if (options?.expectedVersion != null) clauses.push(versionClause(options.expectedVersion));
    if (options?.expectedAmountPaid != null) clauses.push(amountPaidClause(options.expectedAmountPaid));
    if (options?.idempotencyKey) {
      clauses.push({ "payment.ledger.idempotencyKey": { $ne: options.idempotencyKey } });
    }

    const order = await OrderModel.findOneAndUpdate(
      { $and: clauses },
      {
        $set: {
          "payment.status": paymentStatus,
          "payment.method": method,
          "payment.amount": amount,
          "payment.amountPaid": amountPaid,
          "payment.recordedAt": now,
          "payment.recordedBy": actor,
          updatedAt: now,
          ...(options?.expectedVersion != null ? { version: options.expectedVersion + 1 } : {}),
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
    orderStatus: RestaurantOrder["status"] | undefined,
    expectedVersion: number,
  ) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const set: Record<string, unknown> = {
      "payment.status": paymentStatus,
      "payment.amountPaid": amountPaid,
      version: expectedVersion + 1,
      updatedAt: now,
    };
    if (orderStatus) set.status = orderStatus;
    const filter: Record<string, unknown>[] = [{
      restaurantId,
      id,
      "payment.status": { $in: ["PAID", "PARTIAL"] },
      status: { $nin: ["CANCELLED", "REJECTED", "REFUNDED"] },
    }, versionClause(expectedVersion)];

    const order = await OrderModel.findOneAndUpdate(
      { $and: filter },
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
      expectedVersion: number;
      nextStatus?: RestaurantOrder["status"];
      mergedIntoOrderId?: string;
      session?: ClientSession;
    },
  ) {
    await connectToDatabase();
    const set: Record<string, unknown> = {
      items: patch.items,
      subtotal: patch.subtotal,
      taxAmount: patch.taxAmount,
      total: patch.total,
      version: patch.expectedVersion + 1,
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
    if (patch.nextStatus) set.status = patch.nextStatus;
    if (patch.mergedIntoOrderId) set.mergedIntoOrderId = patch.mergedIntoOrderId;

    const order = await OrderModel.findOneAndUpdate(
      {
        $and: [
          { restaurantId, id, status: { $nin: ["CANCELLED", "REJECTED", "REFUNDED", "COMPLETED", "MERGED"] } },
          versionClause(patch.expectedVersion),
        ],
      },
      {
        $set: set,
        $push: { events: patch.event },
      },
      { new: true, runValidators: true, session: patch.session },
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

  async setCaptainAuthorization(
    restaurantId: string,
    id: string,
    patch: {
      authorization: import("@/types").CaptainAuthorization;
      event: OrderEvent;
      expectedAuthorizationStatuses: string[];
      orderStatusOnReject?: RestaurantOrder["status"];
    },
  ) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const set: Record<string, unknown> = {
      captainAuthorization: patch.authorization,
      updatedAt: now,
    };
    if (patch.orderStatusOnReject) {
      set.status = patch.orderStatusOnReject;
    }

    const order = await OrderModel.findOneAndUpdate(
      {
        restaurantId,
        id,
        status: { $in: ["PENDING", "ACCEPTED"] },
        $or: [
          { "captainAuthorization.status": { $in: patch.expectedAuthorizationStatuses } },
          // Legacy QR without field — treat as pending approval.
          {
            captainAuthorization: { $exists: false },
            source: "QR",
            status: "PENDING",
          },
        ],
      },
      {
        $set: set,
        $push: { events: patch.event },
      },
      { new: true, runValidators: true },
    ).lean();
    return order ? this.mapOrder(order) : null;
  }
}

export const orderRepository = new OrderRepository();
