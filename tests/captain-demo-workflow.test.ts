import assert from "node:assert/strict";
import test from "node:test";
import type { OrderSummary, RestaurantOrder } from "../types";
import { calculateRestaurantBill } from "../lib/billing/calculate-bill";
import { consolidateSessionOrders, createBillAllocations } from "../lib/consolidated-billing";
import { queuedKotItems } from "../lib/kot-print";
import { isCaptainKitchenEligible } from "../lib/order-authorization";

const billing = { gstEnabled: true, gstRatePercent: 5, taxLabel: "GST" } as const;

function demoOrder(id: string, tableId: string, sessionId: string, prices: { name: string; price: number; quantity: number }[]): RestaurantOrder {
  const lines = prices.map((item, index) => ({
    lineId: `${id}-${index}`,
    dishId: `dish-${index}`,
    dishNameSnapshot: item.name,
    quantity: item.quantity,
    unitPriceSnapshot: item.price,
    addons: [],
    itemTotal: item.price * item.quantity,
    preparationStatus: "QUEUED" as const,
  }));
  const bill = calculateRestaurantBill({ lines: lines.map((line) => ({ lineTotal: line.itemTotal, quantity: line.quantity })), billing });
  return {
    id, restaurantId: "demo-outlet", tableId, tableNumber: tableId === "room-201" ? 201 : 6,
    tableSessionId: sessionId, orderNumber: Number(id.slice(-1)) + 1020,
    customerTokenHash: "demo", idempotencyKey: id, status: "PENDING", channel: "QR", source: "QR",
    captainAuthorization: { status: "PENDING_CAPTAIN_APPROVAL", entrySource: "CUSTOMER_QR" },
    items: lines, subtotal: bill.itemsSubtotal, taxAmount: bill.taxAmount, total: bill.total,
    payment: { status: "UNPAID", amountPaid: 0, auditTrail: [], ledger: [] },
    createdAt: "2026-11-10T12:00:00.000Z", updatedAt: "2026-11-10T12:00:00.000Z",
  } as RestaurantOrder;
}

test("realistic table service: approval, incremental KOT, GST, tip and split remain consistent", () => {
  const first = demoOrder("order-1", "table-6", "session-6", [
    { name: "Chai", price: 30, quantity: 2 },
    { name: "Fresh Lime Soda", price: 109, quantity: 1 },
  ]);
  assert.equal(first.total, 177.45);
  assert.equal(isCaptainKitchenEligible(first), false);
  first.captainAuthorization = { status: "CAPTAIN_APPROVED", entrySource: "CUSTOMER_QR" };
  assert.equal(isCaptainKitchenEligible(first), true);
  assert.deepEqual(queuedKotItems(first as OrderSummary, [] as string[]).map((line) => line.lineId), ["order-1-0", "order-1-1"]);

  first.kotLineIds = ["order-1-0", "order-1-1"];
  first.items.push({ lineId: "order-1-extra", dishId: "paneer", dishNameSnapshot: "Paneer Tikka", quantity: 1, unitPriceSnapshot: 180, addons: [], itemTotal: 180, preparationStatus: "QUEUED" });
  assert.deepEqual(queuedKotItems(first as OrderSummary, first.kotLineIds).map((line) => line.lineId), ["order-1-extra"]);
  first.items.pop();

  const second = demoOrder("order-2", "table-6", "session-6", [{ name: "Paneer Tikka", price: 180, quantity: 1 }]);
  const room = demoOrder("order-3", "room-201", "session-room-201", [{ name: "Sandwich", price: 120, quantity: 1 }]);
  const tableBill = consolidateSessionOrders([first, second], 20);
  assert.equal(tableBill.total, 386.45);
  assert.equal(tableBill.taxAmount, 17.45);
  assert.equal(tableBill.tipAmount, 20);
  assert.equal(tableBill.orderIds.length, 2);
  assert.equal(consolidateSessionOrders([room]).total, 126);
  const allocations = createBillAllocations({ mode: "EQUAL", total: tableBill.total, lines: tableBill.lines, customers: 2 });
  assert.equal(allocations.reduce((sum, allocation) => sum + allocation.amount, 0), tableBill.total);
});
