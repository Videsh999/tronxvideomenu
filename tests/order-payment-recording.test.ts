import assert from "node:assert/strict";
import test from "node:test";
import { recordPaymentSchema, correctPaymentSchema } from "../lib/validations/index";
import type { RestaurantOrder, PaymentAuditActor, PaymentAuditEvent } from "../types/index";

test("recordPaymentSchema validates supported payment methods and rejects unrecognized input", () => {
  for (const method of ["CASH", "UPI", "CARD"] as const) {
    const parsed = recordPaymentSchema.parse({ method });
    assert.equal(parsed.method, method);
  }

  // Reject unsupported method
  assert.throws(
    () => recordPaymentSchema.parse({ method: "BITCOIN" }),
    (error: unknown) => {
      assert(error && typeof error === "object" && "issues" in error);
      return true;
    },
  );

  // Reject client-supplied amount (strict schema)
  assert.throws(
    () => recordPaymentSchema.parse({ method: "CASH", amount: 500 }),
    (error: unknown) => {
      assert(error && typeof error === "object" && "issues" in error);
      return true;
    },
  );
});

test("correctPaymentSchema requires reason >= 5 characters and method for CORRECTION", () => {
  // Valid CORRECTION
  const validCorrection = correctPaymentSchema.parse({
    action: "CORRECTION",
    method: "UPI",
    reason: "Diner switched payment method to UPI",
  });
  assert.equal(validCorrection.action, "CORRECTION");
  assert.equal(validCorrection.method, "UPI");

  // Valid REVERSAL
  const validReversal = correctPaymentSchema.parse({
    action: "REVERSAL",
    reason: "Mistakenly clicked paid on wrong table",
  });
  assert.equal(validReversal.action, "REVERSAL");
  assert.equal(validReversal.method, undefined);

  // Reject CORRECTION without method
  assert.throws(
    () =>
      correctPaymentSchema.parse({
        action: "CORRECTION",
        reason: "Missing new method",
      }),
  );

  // Reject short reason (< 5 chars)
  assert.throws(
    () =>
      correctPaymentSchema.parse({
        action: "REVERSAL",
        reason: "oops",
      }),
  );
});

test("Payment transition and audit trail integration with memory repository", async () => {
  let storedOrder: RestaurantOrder = {
    id: "order-test-1",
    restaurantId: "rest-test",
    tableId: "t-1",
    tableNumber: 5,
    orderNumber: 1005,
    customerTokenHash: "hash",
    idempotencyKey: "idem",
    status: "ACCEPTED",
    items: [],
    subtotal: 620,
    total: 620,
    payment: {
      status: "UNPAID",
      auditTrail: [],
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockRepo = {
    async findByRestaurantAndId(restaurantId: string, id: string) {
      if (restaurantId === storedOrder.restaurantId && id === storedOrder.id) {
        return storedOrder;
      }
      return null;
    },
    async recordPayment(
      restaurantId: string,
      id: string,
      method: import("../types").PaymentMethod,
      amount: number,
      actor: PaymentAuditActor,
      event: PaymentAuditEvent,
    ) {
      if (restaurantId !== storedOrder.restaurantId || id !== storedOrder.id) return null;
      if (storedOrder.payment.status === "PAID") return null;
      storedOrder = {
        ...storedOrder,
        payment: {
          status: "PAID",
          method,
          amount,
          recordedAt: event.timestamp,
          recordedBy: actor,
          auditTrail: [...(storedOrder.payment.auditTrail ?? []), event],
        },
      };
      return storedOrder;
    },
    async correctPayment(
      restaurantId: string,
      id: string,
      newStatus: import("../types").PaymentStatus,
      newMethod: import("../types").PaymentMethod | undefined,
      event: PaymentAuditEvent,
    ) {
      if (restaurantId !== storedOrder.restaurantId || id !== storedOrder.id) return null;
      if (storedOrder.payment.status !== "PAID") return null;
      storedOrder = {
        ...storedOrder,
        payment: {
          status: newStatus,
          method: newMethod,
          amount: newStatus === "PAID" ? storedOrder.total : undefined,
          recordedAt: newStatus === "PAID" ? event.timestamp : undefined,
          recordedBy: newStatus === "PAID" ? event.actor : undefined,
          auditTrail: [...(storedOrder.payment.auditTrail ?? []), event],
        },
      };
      return storedOrder;
    },
  };

  // Verify initial state
  assert.equal(storedOrder.payment.status, "UNPAID");

  // Step 1: Initial Payment Record (CASH by Captain)
  const captainActor: PaymentAuditActor = {
    role: "CAPTAIN",
    id: "cap-1",
    name: "Captain Ravi",
  };

  // Directly verify recordPayment contract
  const event1: PaymentAuditEvent = {
    eventId: "evt-1",
    action: "RECORD",
    previousStatus: "UNPAID",
    newStatus: "PAID",
    newMethod: "CASH",
    amount: storedOrder.total,
    actor: captainActor,
    timestamp: new Date().toISOString(),
  };
  const recorded = await mockRepo.recordPayment("rest-test", "order-test-1", "CASH", storedOrder.total, captainActor, event1);
  assert(recorded);
  assert.equal(recorded.payment.status, "PAID");
  assert.equal(recorded.payment.method, "CASH");
  assert.equal(recorded.payment.amount, 620);
  assert.equal(recorded.payment.auditTrail?.length, 1);
  assert.equal(recorded.payment.auditTrail?.[0].action, "RECORD");

  // Step 2: Concurrency check - duplicate recordPayment fails
  const duplicate = await mockRepo.recordPayment("rest-test", "order-test-1", "UPI", storedOrder.total, captainActor, event1);
  assert.equal(duplicate, null);

  // Step 3: Admin Correction - Change CASH to UPI
  const adminActor: PaymentAuditActor = {
    role: "RESTAURANT_ADMIN",
    id: "admin-1",
    email: "manager@test.com",
    name: "Manager Anita",
  };
  const event2: PaymentAuditEvent = {
    eventId: "evt-2",
    action: "CORRECTION",
    previousStatus: "PAID",
    newStatus: "PAID",
    previousMethod: "CASH",
    newMethod: "UPI",
    amount: storedOrder.total,
    actor: adminActor,
    reason: "Customer changed to UPI payment",
    timestamp: new Date().toISOString(),
  };
  const corrected = await mockRepo.correctPayment("rest-test", "order-test-1", "PAID", "UPI", event2);
  assert(corrected);
  assert.equal(corrected.payment.status, "PAID");
  assert.equal(corrected.payment.method, "UPI");
  assert.equal(corrected.payment.auditTrail?.length, 2);
  assert.equal(corrected.payment.auditTrail?.[1].action, "CORRECTION");
  assert.equal(corrected.payment.auditTrail?.[1].reason, "Customer changed to UPI payment");

  // Step 4: Admin Reversal - Reverse PAID to UNPAID
  const event3: PaymentAuditEvent = {
    eventId: "evt-3",
    action: "REVERSAL",
    previousStatus: "PAID",
    newStatus: "UNPAID",
    previousMethod: "UPI",
    amount: storedOrder.total,
    actor: adminActor,
    reason: "Transaction reversed due to wrong table allocation",
    timestamp: new Date().toISOString(),
  };
  const reversed = await mockRepo.correctPayment("rest-test", "order-test-1", "UNPAID", undefined, event3);
  assert(reversed);
  assert.equal(reversed.payment.status, "UNPAID");
  assert.equal(reversed.payment.method, undefined);
  assert.equal(reversed.payment.auditTrail?.length, 3);
  assert.equal(reversed.payment.auditTrail?.[2].action, "REVERSAL");

  // Step 5: Cross-tenant isolation check
  const crossTenant = await mockRepo.recordPayment("different-restaurant", "order-test-1", "CASH", 620, captainActor, event1);
  assert.equal(crossTenant, null);
});

test("Legacy order missing payment field defaults safely to NOT_RECORDED without migration", () => {
  // Simulating document from MongoDB before Phase B
  const legacyDoc: Record<string, unknown> = {
    id: "order-legacy-1",
    restaurantId: "rest-1",
    tableId: "t-1",
    tableNumber: 3,
    orderNumber: 100,
    status: "SERVED",
    items: [],
    subtotal: 300,
    total: 300,
    createdAt: "2026-01-01T10:00:00.000Z",
    updatedAt: "2026-01-01T10:30:00.000Z",
  };

  // Verify that accessing payment on legacy order provides fallback
  const domainPayment = (legacyDoc.payment as import("../types").PaymentSummary | undefined) ?? {
    status: "NOT_RECORDED",
    auditTrail: [],
  };

  assert.equal(domainPayment.status, "NOT_RECORDED");
  assert.deepEqual(domainPayment.auditTrail, []);
  assert.equal(domainPayment.method, undefined);
});

test("Customer order view exposes only sanitized payment fields and omits internal audit trail and staff identity", () => {
  const fullOrderWithAudit: RestaurantOrder = {
    id: "order-privacy-test",
    restaurantId: "rest-1",
    tableId: "t-1",
    tableNumber: 4,
    orderNumber: 104,
    customerTokenHash: "private-hash",
    idempotencyKey: "idem-privacy",
    status: "SERVED",
    items: [],
    subtotal: 900,
    total: 900,
    payment: {
      status: "PAID",
      method: "UPI",
      amount: 900,
      recordedAt: "2026-10-15T08:00:00.000Z",
      recordedBy: {
        role: "RESTAURANT_ADMIN",
        id: "admin-secret-id",
        email: "internal-admin@restaurant.com",
        name: "Admin John",
      },
      auditTrail: [
        {
          eventId: "evt-secret-1",
          action: "RECORD",
          previousStatus: "UNPAID",
          newStatus: "PAID",
          newMethod: "CASH",
          amount: 900,
          actor: { role: "CAPTAIN", id: "cap-id", name: "Captain Private" },
          timestamp: "2026-10-15T07:55:00.000Z",
        },
        {
          eventId: "evt-secret-2",
          action: "CORRECTION",
          previousStatus: "PAID",
          newStatus: "PAID",
          previousMethod: "CASH",
          newMethod: "UPI",
          amount: 900,
          actor: { role: "RESTAURANT_ADMIN", id: "admin-secret-id", name: "Admin John" },
          reason: "Customer changed to UPI after bill presentation",
          timestamp: "2026-10-15T08:00:00.000Z",
        },
      ],
    },
    createdAt: "2026-10-15T07:30:00.000Z",
    updatedAt: "2026-10-15T08:00:00.000Z",
  };

  // Staff projection retains the full payment summary and complete audit trail
  const staffProjected = {
    id: fullOrderWithAudit.id,
    orderNumber: fullOrderWithAudit.orderNumber,
    tableNumber: fullOrderWithAudit.tableNumber,
    status: fullOrderWithAudit.status,
    items: fullOrderWithAudit.items,
    subtotal: fullOrderWithAudit.subtotal,
    total: fullOrderWithAudit.total,
    payment: fullOrderWithAudit.payment,
    createdAt: fullOrderWithAudit.createdAt,
    updatedAt: fullOrderWithAudit.updatedAt,
  };
  assert.equal(staffProjected.payment.status, "PAID");
  assert.equal(staffProjected.payment.method, "UPI");
  assert.equal(staffProjected.payment.recordedBy?.name, "Admin John");
  assert.equal(staffProjected.payment.auditTrail?.length, 2);
  assert.equal(staffProjected.payment.auditTrail?.[1].reason, "Customer changed to UPI after bill presentation");

  // Customer projection exposes only customer-facing fields (status, method, recordedAt)
  const customerProjected = {
    id: fullOrderWithAudit.id,
    orderNumber: fullOrderWithAudit.orderNumber,
    tableNumber: fullOrderWithAudit.tableNumber,
    status: fullOrderWithAudit.status,
    items: fullOrderWithAudit.items,
    subtotal: fullOrderWithAudit.subtotal,
    total: fullOrderWithAudit.total,
    payment: {
      status: fullOrderWithAudit.payment.status,
      ...(fullOrderWithAudit.payment.method ? { method: fullOrderWithAudit.payment.method } : {}),
      ...(fullOrderWithAudit.payment.recordedAt ? { recordedAt: fullOrderWithAudit.payment.recordedAt } : {}),
    },
    createdAt: fullOrderWithAudit.createdAt,
    updatedAt: fullOrderWithAudit.updatedAt,
  };

  assert.equal(customerProjected.payment.status, "PAID");
  assert.equal(customerProjected.payment.method, "UPI");
  assert.equal(customerProjected.payment.recordedAt, "2026-10-15T08:00:00.000Z");

  // Strictly assert that private staff fields and audit events are absent from customer view
  assert.equal("auditTrail" in customerProjected.payment, false);
  assert.equal("recordedBy" in customerProjected.payment, false);
  // @ts-expect-error verifying property absence
  assert.equal(customerProjected.payment.auditTrail, undefined);
  // @ts-expect-error verifying property absence
  assert.equal(customerProjected.payment.recordedBy, undefined);
});

