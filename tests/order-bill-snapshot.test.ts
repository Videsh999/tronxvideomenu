import assert from "node:assert/strict";
import test from "node:test";
import { calculateRestaurantBill } from "../lib/billing/calculate-bill";
import {
  billFromStoredLines,
  linesReflectCancellation,
  planLineCancellation,
  snapshotGstRate,
} from "../lib/billing/order-bill";
import { resolveOrderedUnitPrice, VariantPriceError } from "../lib/billing/price-line";
import type { OrderItemSnapshot, RestaurantBillingSettings } from "../types";

const inclusive: RestaurantBillingSettings = {
  gstEnabled: true,
  gstRatePercent: 5,
  taxRatePercent: 5,
  taxLabel: "GST",
  priceMode: "INCLUSIVE",
  supplyType: "INTRA_STATE",
  packagingEnabled: true,
  packagingMethod: "PER_ORDER",
  packagingAmount: 10,
  serviceChargeEnabled: true,
  serviceChargeType: "FIXED",
  serviceChargeAmount: 20,
};

function line(partial: Partial<OrderItemSnapshot> & Pick<OrderItemSnapshot, "lineId" | "unitPriceSnapshot" | "quantity">): OrderItemSnapshot {
  const quantity = partial.quantity;
  const itemTotal = partial.itemTotal ?? partial.unitPriceSnapshot * quantity;
  return {
    dishId: partial.dishId ?? "dish-1",
    dishNameSnapshot: partial.dishNameSnapshot ?? "Dish",
    addons: partial.addons ?? [],
    itemTotal,
    preparationStatus: "QUEUED",
    ...partial,
  };
}

test("variant price is the chosen variant, not the dish base price", () => {
  const dish = {
    name: "Biryani",
    price: 300,
    variants: [
      { id: "half", name: "Half", price: 160, isAvailable: true },
      { id: "full", name: "Full", price: 300, isAvailable: true },
    ],
  };
  assert.deepEqual(resolveOrderedUnitPrice(dish, "half"), {
    unitPrice: 160,
    variantId: "half",
    variantName: "Half",
  });
  assert.throws(() => resolveOrderedUnitPrice(dish), VariantPriceError);
  assert.throws(() => resolveOrderedUnitPrice(dish, "missing"), VariantPriceError);
});

test("inclusive tax is extracted once and cancel recomputes every GST component", () => {
  const items = [
    line({ lineId: "a", unitPriceSnapshot: 105, quantity: 2, gstRateSnapshot: 5, itemTotal: 210 }),
    line({ lineId: "b", unitPriceSnapshot: 50, quantity: 1, gstRateSnapshot: 12, itemTotal: 50 }),
  ];
  const before = billFromStoredLines({
    items,
    billing: inclusive,
    historicalBill: { priceMode: "INCLUSIVE", supplyType: "INTRA_STATE" } as never,
  });
  const direct = calculateRestaurantBill({
    lines: [
      { lineTotal: 210, quantity: 2, gstRatePercent: 5 },
      { lineTotal: 50, quantity: 1, gstRatePercent: 12 },
    ],
    billing: { ...inclusive, priceMode: "INCLUSIVE", supplyType: "INTRA_STATE" },
  });
  assert.deepEqual(before, direct);
  assert.ok(before.taxAmount > 0);
  assert.equal(before.igstAmount, 0);
  assert.ok(before.cgstAmount > 0 && before.sgstAmount > 0);
  assert.equal(before.packagingCharge, 10);
  assert.equal(before.serviceCharge, 20);
  assert.notEqual(before.total, Math.round((before.taxableAmount + before.taxAmount + before.taxAmount) * 100) / 100);

  const planned = planLineCancellation(items, [{ lineId: "a", quantity: 1 }]);
  assert.equal(planned.items[0]?.cancelledQuantity, 1);
  assert.equal(planned.items[0]?.gstRateSnapshot, 5);
  assert.equal(planned.items[0]?.unitPriceSnapshot, 105);
  const after = billFromStoredLines({
    items: planned.items,
    billing: { ...inclusive, priceMode: "EXCLUSIVE", supplyType: "INTER_STATE", gstRatePercent: 18 },
    orderTaxRatePercent: 18,
    historicalBill: before,
  });
  assert.equal(after.priceMode, "INCLUSIVE");
  assert.equal(after.supplyType, "INTRA_STATE");
  assert.equal(after.igstAmount, 0);
  assert.equal(linesReflectCancellation(planned.items, planned.plannedCancelled), true);
  assert.equal(linesReflectCancellation(items, planned.plannedCancelled), false);
});

test("existing line tax snapshot is not replaced by the live catalog rate", () => {
  const items = [
    line({ lineId: "old", unitPriceSnapshot: 100, quantity: 1, gstRateSnapshot: 5, itemTotal: 100 }),
    line({ lineId: "new", unitPriceSnapshot: 80, quantity: 1, gstRateSnapshot: 18, itemTotal: 80 }),
  ];
  const bill = billFromStoredLines({
    items,
    billing: { gstEnabled: true, gstRatePercent: 28, priceMode: "EXCLUSIVE", supplyType: "INTER_STATE", taxLabel: "GST" },
    orderTaxRatePercent: 28,
  });
  const same = calculateRestaurantBill({
    lines: [
      { lineTotal: 100, quantity: 1, gstRatePercent: 5 },
      { lineTotal: 80, quantity: 1, gstRatePercent: 18 },
    ],
    billing: { gstEnabled: true, gstRatePercent: 28, priceMode: "EXCLUSIVE", supplyType: "INTER_STATE", taxLabel: "GST" },
  });
  assert.deepEqual(bill, same);
  assert.equal(bill.igstAmount, bill.taxAmount);
  assert.equal(bill.cgstAmount, 0);
  assert.equal(snapshotGstRate({ dish: { taxRatePercent: 12 }, billing: { gstRatePercent: 5, gstEnabled: true } }), 12);
});
