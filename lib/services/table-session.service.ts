import type { BillSplitMode, PaymentAuditActor, Restaurant, RestaurantTable, TableSession } from "@/types";
import { consolidateSessionOrders, createBillAllocations } from "@/lib/consolidated-billing";
import { tableSessionRepository } from "@/lib/repositories/table-session.repository";

export class TableSessionServiceError extends Error {
  constructor(message: string, readonly statusCode = 409) { super(message); }
}

export class TableSessionService {
  async ensureActive(input: {
    restaurant: Pick<Restaurant, "id" | "organizationId">;
    table: RestaurantTable;
    openedBy: TableSession["openedBy"];
    guestCount?: number;
    customerReference?: string;
  }) {
    const session = await tableSessionRepository.ensureActive({
      organizationId: input.restaurant.organizationId,
      restaurantId: input.restaurant.id,
      serviceLocationId: input.table.id,
      tableNumberSnapshot: input.table.tableNumber,
      locationType: input.table.locationType ?? "TABLE",
      openedBy: input.openedBy,
      guestCount: input.guestCount,
      customerReference: input.customerReference,
      closedAt: undefined,
      closedBy: undefined,
    });
    await tableSessionRepository.attachLegacyOpenOrders(input.restaurant.id, input.table.id, session.id);
    return session;
  }

  async overview(restaurantId: string, serviceLocationId: string) {
    const session = await tableSessionRepository.findActive(restaurantId, serviceLocationId);
    if (!session) return { session: null, orders: [], bill: null };
    const [orders, bill] = await Promise.all([
      tableSessionRepository.listOrders(restaurantId, session.id),
      tableSessionRepository.latestBill(restaurantId, session.id),
    ]);
    return { session, orders, bill };
  }

  async generateBill(input: {
    restaurantId: string;
    tableSessionId: string;
    actor: PaymentAuditActor;
    tipAmount?: number;
    revise?: boolean;
  }) {
    const session = await tableSessionRepository.findById(input.restaurantId, input.tableSessionId);
    if (!session || !["ACTIVE", "BILLING", "PAYMENT_PENDING"].includes(session.status)) throw new TableSessionServiceError("Active table session not found.", 404);
    const [orders, current] = await Promise.all([
      tableSessionRepository.listOrders(input.restaurantId, session.id),
      tableSessionRepository.latestBill(input.restaurantId, session.id),
    ]);
    const consolidated = consolidateSessionOrders(orders, input.tipAmount ?? current?.tipAmount ?? 0);
    if (!consolidated.orderIds.length) throw new TableSessionServiceError("No billable orders exist in this session.");
    if (current?.fingerprint === consolidated.fingerprint && current.status !== "SUPERSEDED") return current;
    if (current && !input.revise) throw new TableSessionServiceError("Orders changed after bill generation. Explicit bill revision is required.");
    if (current?.outstandingAmount && current.outstandingAmount > 0 && current.amountPaid > 0) {
      throw new TableSessionServiceError("A partially paid bill cannot be revised. Settle or reverse its payments first.");
    }
    const amountPaid = Math.max(consolidated.amountPaid, current?.status === "PAID" ? current.amountPaid : 0);
    const outstandingAmount = Math.max(0, Math.round((consolidated.total - amountPaid) * 100) / 100);
    return tableSessionRepository.issueBill({
      organizationId: session.organizationId,
      restaurantId: input.restaurantId,
      tableSessionId: session.id,
      serviceLocationId: session.serviceLocationId,
      status: outstandingAmount === 0 ? "PAID" : "ISSUED",
      ...consolidated,
      amountPaid,
      outstandingAmount,
      splitMode: "NONE",
      allocations: [],
      paymentLedger: current?.status === "PAID" ? current.paymentLedger : [],
      issuedAt: new Date().toISOString(),
      issuedBy: input.actor,
    }, current?.version ?? 0);
  }

  async splitBill(input: {
    restaurantId: string;
    billId: string;
    version: number;
    mode: Exclude<BillSplitMode, "NONE">;
    customers?: number;
    custom?: { label: string; amount: number }[];
    items?: { label: string; lines: { allocationKey: string; quantity: number }[] }[];
  }) {
    const bill = await tableSessionRepository.latestBill(input.restaurantId, (await this.requireBill(input.restaurantId, input.billId)).tableSessionId);
    if (!bill || bill.id !== input.billId || bill.version !== input.version) throw new TableSessionServiceError("Bill version changed. Refresh and try again.");
    if (bill.amountPaid > 0) throw new TableSessionServiceError("Split cannot change after payment has started.");
    const allocations = createBillAllocations({ mode: input.mode, total: bill.total, lines: bill.lines, customers: input.customers, custom: input.custom, items: input.items });
    const updated = await tableSessionRepository.setAllocations(input.restaurantId, bill.id, bill.version, input.mode, allocations);
    if (!updated) throw new TableSessionServiceError("Bill changed concurrently. Refresh and try again.");
    return updated;
  }

  private async requireBill(restaurantId: string, billId: string) {
    // Bill IDs are resolved through active overviews to preserve outlet scoping.
    const { MasterBillModel } = await import("@/lib/db/models");
    const row = await MasterBillModel.findOne({ restaurantId, id: billId }).lean();
    if (!row) throw new TableSessionServiceError("Bill not found.", 404);
    return row as unknown as { tableSessionId: string };
  }

  async recordPayment(input: { restaurantId: string; billId: string; amount: number; method: "CASH" | "UPI" | "CARD"; actor: PaymentAuditActor; idempotencyKey: string; allocationId?: string }) {
    try {
      const bill = await tableSessionRepository.recordPayment(input.restaurantId, input.billId, input.amount, input.method, input.actor, input.idempotencyKey, input.allocationId);
      if (!bill) throw new TableSessionServiceError("Bill not found.", 404);
      return bill;
    } catch (error) {
      if (error instanceof TableSessionServiceError) throw error;
      throw new TableSessionServiceError(error instanceof Error ? error.message : "Unable to record payment.");
    }
  }

  async close(restaurantId: string, tableSessionId: string, actor: PaymentAuditActor) {
    const closed = await tableSessionRepository.close(restaurantId, tableSessionId, actor);
    if (!closed) throw new TableSessionServiceError("Session can close only after the master bill is fully paid.");
    return closed;
  }
}

export const tableSessionService = new TableSessionService();
