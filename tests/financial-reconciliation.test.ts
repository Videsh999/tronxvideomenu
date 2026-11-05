import assert from "node:assert/strict";
import test from "node:test";
import { aiEvaluationService } from "../lib/services/ai-evaluation.service";
import {
  computeFinancialRollup,
  reconcileFinancial,
  revenueByOutlet,
} from "../lib/analytics/financial";
import type { RestaurantOrder } from "../types";

test("financial reconciliation fixture fully passes", () => {
  const result = aiEvaluationService.runFinancial();
  assert.equal(result.fail, 0, JSON.stringify(result.rows.filter((r) => !r.pass), null, 2));
  assert.ok(result.pass >= 10);
  assert.equal(result.rollup.grossOrderSales, 474);
  assert.equal(result.rollup.netCollected, 334);
  assert.equal(result.rollup.outstandingApprox, 60);
});

test("cancelled orders excluded from gross but counted in cancel tally", () => {
  const orders = [
    {
      id: "a",
      restaurantId: "r",
      tableId: "t",
      tableNumber: 1,
      orderNumber: 1,
      customerTokenHash: "x",
      idempotencyKey: "a",
      status: "COMPLETED",
      items: [],
      subtotal: 100,
      total: 100,
      payment: { status: "PAID", amountPaid: 100, auditTrail: [], ledger: [] },
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
    },
    {
      id: "b",
      restaurantId: "r",
      tableId: "t",
      tableNumber: 1,
      orderNumber: 2,
      customerTokenHash: "x",
      idempotencyKey: "b",
      status: "CANCELLED",
      items: [],
      subtotal: 999,
      total: 999,
      payment: { status: "UNPAID", amountPaid: 0, auditTrail: [], ledger: [] },
      createdAt: "2026-05-01T11:00:00.000Z",
      updatedAt: "2026-05-01T11:00:00.000Z",
    },
  ] as RestaurantOrder[];
  const rollup = computeFinancialRollup(orders);
  assert.equal(rollup.grossOrderSales, 100);
  assert.equal(rollup.cancelledOrRejected, 1);
});

test("failed/unpaid amounts are not counted as collected", () => {
  const orders = [
    {
      id: "a",
      restaurantId: "r",
      tableId: "t",
      tableNumber: 1,
      orderNumber: 1,
      customerTokenHash: "x",
      idempotencyKey: "a",
      status: "COMPLETED",
      items: [],
      subtotal: 200,
      total: 200,
      payment: {
        status: "UNPAID",
        amountPaid: 0,
        auditTrail: [],
        ledger: [], // no charge recorded
      },
      createdAt: "2026-05-01T10:00:00.000Z",
      updatedAt: "2026-05-01T10:00:00.000Z",
    },
  ] as RestaurantOrder[];
  const rollup = computeFinancialRollup(orders);
  assert.equal(rollup.paymentsCollected, 0);
  assert.equal(rollup.outstandingApprox, 200);
});

test("outlet revenue aggregation does not double-count", () => {
  const order = {
    id: "a",
    restaurantId: "r1",
    tableId: "t",
    tableNumber: 1,
    orderNumber: 1,
    customerTokenHash: "x",
    idempotencyKey: "a",
    status: "COMPLETED",
    items: [],
    subtotal: 50,
    total: 50,
    payment: {
      status: "PAID",
      amountPaid: 50,
      auditTrail: [],
      ledger: [
        {
          id: "l",
          kind: "CHARGE",
          method: "CASH",
          amount: 50,
          recordedAt: "2026-05-01T10:00:00.000Z",
          recordedBy: { role: "RESTAURANT_ADMIN", id: "a" },
        },
      ],
    },
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z",
  } as RestaurantOrder;
  const rows = revenueByOutlet([
    { restaurantId: "r1", orders: [order] },
    { restaurantId: "r2", orders: [] },
  ]);
  assert.equal(rows.find((r) => r.restaurantId === "r1")?.grossOrderSales, 50);
  assert.equal(rows.find((r) => r.restaurantId === "r2")?.grossOrderSales, 0);
});

test("reconcileFinancial fails visibly on mismatch", () => {
  const rollup = computeFinancialRollup([]);
  const rows = reconcileFinancial(rollup, { grossOrderSales: 99 });
  assert.equal(rows[0]?.pass, false);
  assert.ok(rows[0]?.explanation.includes("Mismatch"));
});
