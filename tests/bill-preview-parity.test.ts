import assert from "node:assert/strict";
import test from "node:test";
import { calculateRestaurantBill } from "../lib/billing/calculate-bill";
import { billFromStoredLines } from "../lib/billing/order-bill";
import { previewStaffCartBill } from "../lib/billing/preview-cart";
import { lineItemTotal } from "../lib/order-pricing";
import type { OrderItemSnapshot, RestaurantBillingSettings } from "../types";

const cases: Array<{ name: string; billing: RestaurantBillingSettings; discount: number }> = [
  {
    name: "mixed rates",
    discount: 15,
    billing: {
      gstEnabled: true,
      gstRatePercent: 5,
      priceMode: "EXCLUSIVE",
      supplyType: "INTRA_STATE",
      taxLabel: "GST",
      packagingEnabled: true,
      packagingMethod: "PER_QUANTITY",
      packagingAmount: 4,
      serviceChargeEnabled: true,
      serviceChargeType: "PERCENT",
      serviceChargePercent: 5,
    },
  },
  {
    name: "inclusive IGST",
    discount: 0,
    billing: {
      gstEnabled: true,
      gstRatePercent: 18,
      priceMode: "INCLUSIVE",
      supplyType: "INTER_STATE",
      taxLabel: "GST",
      packagingEnabled: true,
      packagingMethod: "PERCENT_OF_SUBTOTAL",
      packagingPercent: 2,
      serviceChargeEnabled: true,
      serviceChargeType: "FIXED",
      serviceChargeAmount: 25,
    },
  },
];

const cart = [
  { unitPrice: 120, quantity: 2, cancelledQuantity: 1, addonUnitPrices: [10], itemDiscountAmount: 20, gstRatePercent: 5 },
  { unitPrice: 80, quantity: 1, addonUnitPrices: [], itemDiscountAmount: 0, gstRatePercent: 12 },
];

test("staff preview matches the server bill for mixed rates, inclusive tax, IGST, discounts, charges, and cancelled quantities", () => {
  for (const entry of cases) {
    const preview = previewStaffCartBill({
      lines: cart,
      billDiscountAmount: entry.discount,
      billing: entry.billing,
    });
    const storedItems: OrderItemSnapshot[] = cart.map((line, index) => {
      const activeQty = line.quantity - (line.cancelledQuantity ?? 0);
      const itemTotal = activeQty < 1
        ? 0
        : lineItemTotal({
            unitPrice: line.unitPrice,
            quantity: activeQty,
            addonTotals: line.addonUnitPrices,
            itemDiscountAmount: line.itemDiscountAmount
              ? Math.round(((line.itemDiscountAmount * activeQty) / line.quantity) * 100) / 100
              : 0,
          });
      return {
        lineId: `line-${index}`,
        dishId: `dish-${index}`,
        dishNameSnapshot: `Dish ${index}`,
        quantity: line.quantity,
        cancelledQuantity: line.cancelledQuantity,
        unitPriceSnapshot: line.unitPrice,
        addons: [],
        itemDiscountAmount: line.itemDiscountAmount,
        gstRateSnapshot: line.gstRatePercent,
        itemTotal,
      };
    });
    const stored = billFromStoredLines({
      items: storedItems,
      billDiscountAmount: entry.discount,
      billing: entry.billing,
    });
    const direct = calculateRestaurantBill({
      lines: storedItems
        .filter((item) => item.quantity - (item.cancelledQuantity ?? 0) > 0)
        .map((item) => ({
          lineTotal: item.itemTotal,
          quantity: item.quantity - (item.cancelledQuantity ?? 0),
          gstRatePercent: item.gstRateSnapshot,
        })),
      billDiscountAmount: Math.min(entry.discount, stored.itemsSubtotal),
      billing: entry.billing,
    });
    assert.deepEqual(preview, stored, entry.name);
    assert.deepEqual(stored, direct, entry.name);
    if (entry.billing.supplyType === "INTER_STATE") {
      assert.equal(preview.cgstAmount, 0);
      assert.equal(preview.sgstAmount, 0);
      assert.ok(preview.igstAmount > 0);
    }
    if (entry.billing.priceMode === "INCLUSIVE") {
      assert.equal(preview.total, Math.round((preview.taxableAmount + preview.taxAmount) * 100) / 100);
    }
    assert.ok(preview.packagingCharge > 0, entry.name);
    assert.ok(preview.serviceCharge > 0, entry.name);
  }
});
