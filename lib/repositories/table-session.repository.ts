import { randomUUID } from "node:crypto";
import type { MasterBill, PaymentAuditActor, RestaurantOrder, TableSession } from "@/types";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MasterBillModel, OrderModel, TableModel, TableSessionModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";

export class TableSessionRepository {
  async findActive(restaurantId: string, serviceLocationId: string) {
    await connectToDatabase();
    const row = await TableSessionModel.findOne({ restaurantId, serviceLocationId, status: { $in: ["ACTIVE", "BILLING", "PAYMENT_PENDING"] } }).lean();
    return row ? toDomain<TableSession>(row) : null;
  }

  async findById(restaurantId: string, id: string) {
    await connectToDatabase();
    const row = await TableSessionModel.findOne({ restaurantId, id }).lean();
    return row ? toDomain<TableSession>(row) : null;
  }

  async findHistory(restaurantId: string, serviceLocationId: string, limit = 100) {
    await connectToDatabase();
    const rows = await TableSessionModel.find({ restaurantId, serviceLocationId }).sort({ openedAt: -1 }).limit(limit).lean();
    return rows.map((row) => toDomain<TableSession>(row));
  }

  async ensureActive(input: Omit<TableSession, "id" | "sessionNumber" | "version" | "status" | "billingStatus" | "openedAt" | "createdAt" | "updatedAt">) {
    await connectToDatabase();
    const existing = await this.findActive(input.restaurantId, input.serviceLocationId);
    if (existing) return existing;
    const now = new Date().toISOString();
    const id = `session-${randomUUID()}`;
    const sessionNumber = `S-${now.replace(/\D/g, "").slice(0, 14)}-${id.slice(-6).toUpperCase()}`;
    try {
      const created = await TableSessionModel.create({ ...input, id, sessionNumber, status: "ACTIVE", billingStatus: "OPEN", version: 1, openedAt: now, createdAt: now, updatedAt: now });
      return toDomain<TableSession>(created.toObject());
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
      const winner = await this.findActive(input.restaurantId, input.serviceLocationId);
      if (!winner) throw error;
      return winner;
    }
  }

  async attachOrder(restaurantId: string, orderId: string, tableSessionId: string) {
    await connectToDatabase();
    const row = await OrderModel.findOneAndUpdate(
      { restaurantId, id: orderId, $or: [{ tableSessionId: { $exists: false } }, { tableSessionId }] },
      { $set: { tableSessionId, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();
    return row ? toDomain(row) : null;
  }

  async attachLegacyOpenOrders(restaurantId: string, serviceLocationId: string, tableSessionId: string) {
    await connectToDatabase();
    await OrderModel.updateMany(
      { restaurantId, tableId: serviceLocationId, $or: [{ tableSessionId: { $exists: false } }, { tableSessionId: null }, { tableSessionId: "" }], status: { $in: ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED"] } },
      { $set: { tableSessionId, updatedAt: new Date().toISOString() } },
    );
  }

  async listOrders(restaurantId: string, tableSessionId: string) {
    await connectToDatabase();
    const rows = await OrderModel.find({ restaurantId, tableSessionId }).sort({ createdAt: 1 }).lean();
    return rows.map((row) => toDomain<RestaurantOrder>(row));
  }

  async latestBill(restaurantId: string, tableSessionId: string) {
    await connectToDatabase();
    const row = await MasterBillModel.findOne({ restaurantId, tableSessionId }).sort({ version: -1 }).lean();
    return row ? toDomain<MasterBill>(row) : null;
  }

  async issueBill(input: Omit<MasterBill, "id" | "billNumber" | "version" | "createdAt" | "updatedAt">, expectedLatestVersion: number) {
    await connectToDatabase();
    const session = await MasterBillModel.startSession();
    try {
      let result: MasterBill | null = null;
      await session.withTransaction(async () => {
        const now = new Date().toISOString();
        const current = await MasterBillModel.findOne({ restaurantId: input.restaurantId, tableSessionId: input.tableSessionId }).sort({ version: -1 }).session(session).lean();
        const actualVersion = Number(current?.version ?? 0);
        if (actualVersion !== expectedLatestVersion) throw new Error("Bill changed concurrently. Refresh and try again.");
        if (current && !["PAID", "VOID", "SUPERSEDED"].includes(String(current.status))) {
          await MasterBillModel.updateOne({ restaurantId: input.restaurantId, id: current.id, version: actualVersion }, { $set: { status: "SUPERSEDED", supersededAt: now, updatedAt: now } }, { session });
        }
        const version = actualVersion + 1;
        const id = `bill-${randomUUID()}`;
        const billNumber = `B-${input.tableSessionId.slice(-6).toUpperCase()}-${version}`;
        const rows = await MasterBillModel.create([{ ...input, id, billNumber, version, createdAt: now, updatedAt: now }], { session });
        await TableSessionModel.updateOne(
          { restaurantId: input.restaurantId, id: input.tableSessionId, version: { $gte: 1 } },
          { $set: { status: input.outstandingAmount > 0 ? "PAYMENT_PENDING" : "BILLING", billingStatus: input.outstandingAmount > 0 ? "ISSUED" : "PAID", updatedAt: now }, $inc: { version: 1 } },
          { session },
        );
        result = toDomain<MasterBill>(rows[0].toObject());
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  async setAllocations(restaurantId: string, billId: string, version: number, splitMode: MasterBill["splitMode"], allocations: MasterBill["allocations"]) {
    await connectToDatabase();
    const row = await MasterBillModel.findOneAndUpdate(
      { restaurantId, id: billId, version, status: { $in: ["ISSUED", "PARTIALLY_PAID"] }, amountPaid: 0 },
      { $set: { splitMode, allocations, updatedAt: new Date().toISOString() } },
      { new: true },
    ).lean();
    return row ? toDomain<MasterBill>(row) : null;
  }

  async recordPayment(restaurantId: string, billId: string, amount: number, method: "CASH" | "UPI" | "CARD", actor: PaymentAuditActor, idempotencyKey: string, allocationId?: string) {
    await connectToDatabase();
    const bill = await MasterBillModel.findOne({ restaurantId, id: billId }).lean();
    if (!bill) return null;
    const current = toDomain<MasterBill>(bill);
    if (current.paymentLedger.some((entry) => entry.id === idempotencyKey)) return current;
    const latest = await MasterBillModel.findOne({ restaurantId, tableSessionId: current.tableSessionId }).sort({ version: -1 }).select({ id: 1 }).lean();
    if (latest?.id !== billId || !["ISSUED", "PARTIALLY_PAID"].includes(current.status)) throw new Error("This bill is no longer payable. Refresh the latest bill.");
    if (amount <= 0 || amount > current.outstandingAmount) throw new Error("Payment exceeds the outstanding bill balance.");
    if (allocationId) {
      const allocation = current.allocations.find((row) => row.id === allocationId);
      if (!allocation) throw new Error("Split allocation not found.");
      if (amount > allocation.amount - allocation.amountPaid) throw new Error("Payment exceeds the allocation balance.");
      allocation.amountPaid = Math.round((allocation.amountPaid + amount) * 100) / 100;
      allocation.status = allocation.amountPaid >= allocation.amount ? "PAID" : "PARTIAL";
    }
    const now = new Date().toISOString();
    const amountPaid = Math.round((current.amountPaid + amount) * 100) / 100;
    const outstandingAmount = Math.max(0, Math.round((current.total - amountPaid) * 100) / 100);
    const status = outstandingAmount === 0 ? "PAID" : "PARTIALLY_PAID";
    current.paymentLedger.push({ id: idempotencyKey, kind: "CHARGE", method, amount, recordedAt: now, recordedBy: actor });
    const row = await MasterBillModel.findOneAndUpdate(
      { restaurantId, id: billId, version: current.version, status: { $in: ["ISSUED", "PARTIALLY_PAID"] }, amountPaid: current.amountPaid, outstandingAmount: { $gte: amount } },
      { $set: { amountPaid, outstandingAmount, status, allocations: current.allocations, paymentLedger: current.paymentLedger, updatedAt: now } },
      { new: true },
    ).lean();
    if (!row) throw new Error("Bill payment changed concurrently. Refresh and try again.");
    if (status === "PAID") {
      await TableSessionModel.updateOne({ restaurantId, id: current.tableSessionId, status: "CLOSED" }, { $set: { billingStatus: "PAID", updatedAt: now }, $inc: { version: 1 } });
      await TableSessionModel.updateOne({ restaurantId, id: current.tableSessionId, status: { $ne: "CLOSED" } }, { $set: { billingStatus: "PAID", status: "BILLING", updatedAt: now }, $inc: { version: 1 } });
    }
    return toDomain<MasterBill>(row);
  }

  async close(restaurantId: string, id: string, actor: PaymentAuditActor) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const transaction = await TableSessionModel.startSession();
    try {
      const closed = await transaction.withTransaction(async () => {
        const orders = await OrderModel.find({ restaurantId, tableSessionId: id }).session(transaction).lean();
        if (orders.some((order) => order.status === "PENDING" || order.items.some((item: { lineId?: string }) => item.lineId && !(order.kotLineIds ?? []).includes(item.lineId) && ((order.kotLineIds ?? []).length > 0 || order.status === "ACCEPTED")))) {
          throw new Error("Send every new item to the kitchen before finishing this table.");
        }
        const bill = await MasterBillModel.findOne({ restaurantId, tableSessionId: id }).sort({ version: -1 }).session(transaction).lean();
        if (!bill || bill.status !== "PAID" || Number(bill.outstandingAmount) > 0) {
          throw new Error("Record the customer's full payment before completing this table visit.");
        }
        const row = await TableSessionModel.findOneAndUpdate(
          { restaurantId, id, status: { $in: ["ACTIVE", "BILLING", "PAYMENT_PENDING"] }, billingStatus: { $in: ["ISSUED", "PARTIALLY_PAID", "PAID"] } },
          { $set: { status: "CLOSED", closedAt: now, closedBy: actor, updatedAt: now }, $inc: { version: 1 } },
          { new: true, session: transaction },
        ).lean();
        if (!row) return null;
        const paidAt = bill.paymentLedger?.filter((entry: { kind: string }) => entry.kind === "CHARGE").at(-1)?.recordedAt ?? now;
        const paidBy = bill.paymentLedger?.filter((entry: { kind: string }) => entry.kind === "CHARGE").at(-1)?.recordedBy ?? actor;
        for (const order of orders) {
          if (["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"].includes(String(order.status))) continue;
          const previousAmountPaid = Number(order.payment?.amountPaid ?? 0);
          const remainingForOrder = Math.max(0, Math.round((Number(order.total ?? 0) - previousAmountPaid) * 100) / 100);
          const orderPaidAt = remainingForOrder > 0 ? paidAt : order.payment?.recordedAt ?? paidAt;
          const orderPaidBy = remainingForOrder > 0 ? paidBy : order.payment?.recordedBy ?? paidBy;
          const auditTrail = remainingForOrder > 0 ? {
            eventId: `bill-settlement:${bill.id}:${order.id}`,
            action: "RECORD",
            previousStatus: order.payment?.status ?? "UNPAID",
            newStatus: "PAID",
            amount: remainingForOrder,
            actor: orderPaidBy,
            reason: `Settled with consolidated bill ${bill.billNumber}`,
            timestamp: orderPaidAt,
          } : null;
          await OrderModel.updateOne(
            { restaurantId, id: order.id, tableSessionId: id, status: { $nin: ["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"] } },
            {
              $set: {
                status: "COMPLETED",
                completedAt: now,
                updatedAt: now,
                "payment.status": "PAID",
                "payment.amountPaid": Number(order.total ?? previousAmountPaid),
                "payment.recordedAt": orderPaidAt,
                "payment.recordedBy": orderPaidBy,
              },
              $push: {
                events: { id: `event-${randomUUID()}`, type: "STATUS_CHANGED", at: now, actor, message: `Table visit completed after bill ${bill.billNumber} was paid`, meta: { to: "COMPLETED", tableSessionId: id, billId: bill.id, billNumber: bill.billNumber } },
                ...(auditTrail ? { "payment.auditTrail": auditTrail } : {}),
              },
            },
            { session: transaction },
          );
        }
        await TableModel.updateOne(
          { restaurantId, id: row.serviceLocationId, status: { $ne: "CLOSED" } },
          { $set: { status: "OPEN", updatedAt: now } },
          { session: transaction },
        );
        return toDomain<TableSession>(row);
      });
      return closed ?? null;
    } finally {
      await transaction.endSession();
    }
  }

  async moveSession(restaurantId: string, sessionId: string, destination: { id: string; tableNumber: number; locationType: "TABLE" | "ROOM" }) {
    await connectToDatabase();
    const transaction = await TableSessionModel.startSession();
    try {
      let moved: TableSession | null = null;
      await transaction.withTransaction(async () => {
        const source = await TableSessionModel.findOne({ restaurantId, id: sessionId, status: "ACTIVE" }).session(transaction).lean();
        if (!source) return;
        if (await MasterBillModel.exists({ restaurantId, tableSessionId: sessionId }).session(transaction)) throw new Error("An issued bill prevents table transfer.");
        if (await TableSessionModel.exists({ restaurantId, serviceLocationId: destination.id, status: { $in: ["ACTIVE", "BILLING", "PAYMENT_PENDING"] } }).session(transaction)) throw new Error("Destination already has an active session.");
        const now = new Date().toISOString();
        const updated = await TableSessionModel.findOneAndUpdate(
          { restaurantId, id: sessionId, status: "ACTIVE", version: source.version },
          { $set: { serviceLocationId: destination.id, tableNumberSnapshot: destination.tableNumber, locationType: destination.locationType, updatedAt: now }, $inc: { version: 1 } },
          { new: true, session: transaction },
        ).lean();
        if (!updated) throw new Error("Table session changed concurrently.");
        await OrderModel.updateMany({ restaurantId, tableSessionId: sessionId }, { $set: { tableId: destination.id, tableNumber: destination.tableNumber, locationType: destination.locationType, updatedAt: now } }, { session: transaction });
        await TableModel.updateOne({ restaurantId, id: source.serviceLocationId }, { $set: { status: "OPEN", updatedAt: now } }, { session: transaction });
        await TableModel.updateOne({ restaurantId, id: destination.id }, { $set: { status: "OCCUPIED", updatedAt: now } }, { session: transaction });
        moved = toDomain<TableSession>(updated);
      });
      return moved;
    } finally {
      await transaction.endSession();
    }
  }

  async mergeSessions(restaurantId: string, sourceSessionId: string, destinationSessionId: string) {
    await connectToDatabase();
    if (sourceSessionId === destinationSessionId) return null;
    const transaction = await TableSessionModel.startSession();
    try {
      let merged: TableSession | null = null;
      await transaction.withTransaction(async () => {
        const source = await TableSessionModel.findOne({ restaurantId, id: sourceSessionId, status: "ACTIVE" }).session(transaction).lean();
        const destination = await TableSessionModel.findOne({ restaurantId, id: destinationSessionId, status: "ACTIVE" }).session(transaction).lean();
        if (!source || !destination) return;
        if (await MasterBillModel.exists({ restaurantId, tableSessionId: { $in: [sourceSessionId, destinationSessionId] } }).session(transaction)) throw new Error("An issued bill prevents table merge.");
        const now = new Date().toISOString();
        await OrderModel.updateMany({ restaurantId, tableSessionId: sourceSessionId }, { $set: { tableSessionId: destinationSessionId, tableId: destination.serviceLocationId, tableNumber: destination.tableNumberSnapshot, locationType: destination.locationType, updatedAt: now } }, { session: transaction });
        const closed = await TableSessionModel.updateOne({ restaurantId, id: sourceSessionId, status: "ACTIVE", version: source.version }, { $set: { status: "CLOSED", billingStatus: "VOID", closedAt: now, updatedAt: now }, $inc: { version: 1 } }, { session: transaction });
        if (closed.modifiedCount !== 1) throw new Error("Source session changed concurrently.");
        await TableModel.updateOne({ restaurantId, id: source.serviceLocationId }, { $set: { status: "OPEN", updatedAt: now } }, { session: transaction });
        merged = toDomain<TableSession>(destination);
      });
      return merged;
    } finally {
      await transaction.endSession();
    }
  }
}

export const tableSessionRepository = new TableSessionRepository();
