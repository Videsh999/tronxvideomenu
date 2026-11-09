import assert from "node:assert/strict";
import test from "node:test";
import { calculateRestaurantBill } from "../lib/billing/calculate-bill";

test("customer cart preview includes configured service charge and GST", () => {
  const bill = calculateRestaurantBill({
    lines: [{ lineTotal: 30, quantity: 1, gstRatePercent: 5 }],
    billing: {
      gstEnabled: true,
      gstRatePercent: 5,
      serviceChargeEnabled: true,
      serviceChargeType: "PERCENT",
      serviceChargePercent: 10,
      priceMode: "EXCLUSIVE",
      supplyType: "INTRA_STATE",
    },
  });
  assert.equal(bill.itemsSubtotal, 30);
  assert.equal(bill.serviceCharge, 3);
  assert.equal(bill.taxAmount, 1.65);
  assert.equal(bill.total, 34.65);
});
