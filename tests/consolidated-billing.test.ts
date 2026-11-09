import assert from "node:assert/strict";
import test from "node:test";
import type { RestaurantOrder } from "../types/index";
import { consolidateSessionOrders, createBillAllocations } from "../lib/consolidated-billing";

function order(id: string, orderNumber: number, sessionId: string, tableId: string, total: number, quantity = 1): RestaurantOrder {
  return {
    id, orderNumber, restaurantId: "restaurant-1", tableId, tableNumber: tableId === "table-1" ? 1 : 2,
    tableSessionId: sessionId, customerTokenHash: "hash", idempotencyKey: id, status: "SERVED", channel: "QR", source: "QR",
    items: [{ lineId: `${id}-line`, dishId: `${id}-dish`, dishNameSnapshot: `Dish ${id}`, quantity, unitPriceSnapshot: total / quantity, addons: [], itemTotal: total }],
    subtotal: total, taxAmount: 0, total, payment: { status: "UNPAID", amountPaid: 0, auditTrail: [], ledger: [] },
    createdAt: `2026-11-09T10:0${orderNumber}:00.000Z`, updatedAt: `2026-11-09T10:0${orderNumber}:00.000Z`,
  };
}

test("multiple independent orders consolidate once for one table session", () => {
  const result = consolidateSessionOrders([
    order("o1", 101, "s1", "table-1", 274),
    order("o2", 102, "s1", "table-1", 310),
    order("o3", 103, "s1", "table-1", 120),
  ]);
  assert.deepEqual(result.orderIds, ["o1", "o2", "o3"]);
  assert.equal(result.lines.length, 3);
  assert.equal(result.total, 704);
  assert.equal(result.outstandingAmount, 704);
  assert.equal(new Set(result.lines.map((line) => line.allocationKey)).size, 3);
});

test("table sessions remain financially isolated", () => {
  const table1 = [order("o1", 101, "s1", "table-1", 274), order("o2", 102, "s1", "table-1", 310)];
  const table2 = [order("o3", 201, "s2", "table-2", 920)];
  assert.equal(consolidateSessionOrders(table1).total, 584);
  assert.equal(consolidateSessionOrders(table2).total, 920);
});

test("cancelled orders and cancelled quantities are not double charged", () => {
  const cancelled = { ...order("o2", 102, "s1", "table-1", 310), status: "CANCELLED" as const };
  const partial = order("o1", 101, "s1", "table-1", 300, 3);
  partial.items[0].cancelledQuantity = 1;
  const result = consolidateSessionOrders([partial, cancelled]);
  assert.equal(result.orderIds.length, 1);
  assert.equal(result.lines[0].billableQuantity, 2);
  assert.equal(result.lines[0].lineTotal, 200);
});

test("equal split distributes paise exactly without overpayment", () => {
  const allocations = createBillAllocations({ mode: "EQUAL", total: 704, lines: [], customers: 5 });
  assert.equal(allocations.length, 5);
  assert.equal(allocations.reduce((sum, row) => sum + row.amount, 0), 704);
});

test("custom split must equal the master bill", () => {
  assert.throws(() => createBillAllocations({ mode: "CUSTOM", total: 704, lines: [], custom: [{ label: "A", amount: 300 }, { label: "B", amount: 300 }] }), /equal/);
});

test("item split rejects duplicate allocation and requires every quantity", () => {
  const bill = consolidateSessionOrders([order("o1", 101, "s1", "table-1", 300, 3)]);
  assert.throws(() => createBillAllocations({
    mode: "ITEMS", total: 300, lines: bill.lines,
    items: [
      { label: "A", lines: [{ allocationKey: bill.lines[0].allocationKey, quantity: 2 }] },
      { label: "B", lines: [{ allocationKey: bill.lines[0].allocationKey, quantity: 2 }] },
    ],
  }), /more than once/);
});
