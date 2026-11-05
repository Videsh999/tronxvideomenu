import assert from "node:assert/strict";
import test from "node:test";
import { computeBillTotals, lineItemTotal } from "../lib/order-pricing";
import type { OrderItemSnapshot, RestaurantOrder } from "../types/index";

test("historical invoice totals stay fixed when live menu prices change", () => {
  const snapshotItems: OrderItemSnapshot[] = [
    {
      lineId: "line-1",
      dishId: "dish-burger",
      dishNameSnapshot: "House Burger",
      variantId: "var-reg",
      variantNameSnapshot: "Regular",
      quantity: 2,
      unitPriceSnapshot: 180,
      addons: [
        {
          addonId: "addon-cheese",
          nameSnapshot: "Cheese",
          quantity: 1,
          unitPriceSnapshot: 20,
          total: 20,
        },
      ],
      itemDiscountAmount: 10,
      kitchenStation: "MAIN",
      preparationStatus: "QUEUED",
      itemTotal: lineItemTotal({
        unitPrice: 180,
        quantity: 2,
        addonTotals: [20],
        itemDiscountAmount: 10,
      }),
    },
  ];

  const bill = computeBillTotals({
    lineTotals: snapshotItems.map((item) => item.itemTotal),
    billDiscountAmount: 20,
    taxRatePercent: 5,
  });

  const invoice: Pick<
    RestaurantOrder,
    "items" | "subtotal" | "billDiscountAmount" | "taxRatePercent" | "taxAmount" | "total"
  > = {
    items: snapshotItems,
    subtotal: bill.itemsSubtotal,
    billDiscountAmount: bill.billDiscount,
    taxRatePercent: 5,
    taxAmount: bill.taxAmount,
    total: bill.total,
  };

  // Live menu later changes burger to 250 and tax to 12% — invoice must not move.
  const liveDishPrice = 250;
  const liveTax = 12;
  assert.notEqual(liveDishPrice, invoice.items[0].unitPriceSnapshot);
  assert.notEqual(liveTax, invoice.taxRatePercent);

  const recomputedFromSnapshots = computeBillTotals({
    lineTotals: invoice.items.map((item) => item.itemTotal),
    billDiscountAmount: invoice.billDiscountAmount,
    taxRatePercent: invoice.taxRatePercent,
  });

  assert.equal(recomputedFromSnapshots.total, invoice.total);
  assert.equal(invoice.items[0].itemTotal, 390);
  assert.equal(invoice.total, 388.5);
  assert.equal(invoice.items[0].dishNameSnapshot, "House Burger");
});
