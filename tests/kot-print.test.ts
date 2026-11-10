import assert from "node:assert/strict";
import test from "node:test";
import type { OrderSummary } from "../types/index";
import { buildKitchenOrderTicketHtml, queuedKotItems } from "../lib/kot-print";

const order = {
  id: "order-1",
  orderNumber: 412,
  tableId: "room-204",
  tableNumber: 204,
  locationType: "ROOM",
  status: "ACCEPTED",
  source: "QR",
  items: [{
    dishId: "dish-1",
    dishNameSnapshot: "Paneer <Hot>",
    variantNameSnapshot: "Large",
    quantity: 2,
    unitPriceSnapshot: 180,
    addons: [{ addonId: "addon-1", nameSnapshot: "Extra cheese", quantity: 1, unitPriceSnapshot: 20, total: 20 }],
    note: "No onion",
    itemTotal: 380,
  }],
  subtotal: 380,
  taxAmount: 19,
  total: 399,
  payment: { status: "UNPAID" },
  createdAt: "2026-11-07T10:00:00.000Z",
  updatedAt: "2026-11-07T10:00:00.000Z",
} as OrderSummary;

test("browser KOT includes order, room, item pricing, addons, notes and totals", () => {
  const html = buildKitchenOrderTicketHtml(order, "Hotel TRONX");
  for (const expected of ["ORDER #412", "Room 204", "Paneer &lt;Hot&gt;", "Large", "Extra cheese", "No onion", "₹180.00", "₹380.00", "₹19.00", "₹399.00"]) {
    assert.ok(html.includes(expected), `missing ${expected}`);
  }
  assert.ok(!html.includes("Paneer <Hot>"), "dish names must be HTML escaped");
});

test("first and later KOT batches contain only lines not previously sent", () => {
  const ticket = {
    ...order,
    kotLineIds: ["first", "second"],
    items: [
      { ...order.items[0], lineId: "first" },
      { ...order.items[0], lineId: "second" },
    ],
  } as OrderSummary;
  assert.deepEqual(queuedKotItems(ticket, []).map((item) => item.lineId), ["first", "second"]);
  assert.deepEqual(queuedKotItems(ticket, ["first"]).map((item) => item.lineId), ["second"]);
  assert.deepEqual(queuedKotItems(ticket).map((item) => item.lineId), []);
});
