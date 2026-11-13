import assert from "node:assert/strict";
import test from "node:test";
import { allocateSplitBills } from "../lib/billing/split-bill";
import { billFromStoredLines } from "../lib/billing/order-bill";
import type { OrderItemSnapshot } from "../types";

test("split bills add up to the original bill to the paisa", () => {
  const billing = {
    gstEnabled: true,
    gstRatePercent: 5,
    taxRatePercent: 5,
    taxLabel: "GST",
    priceMode: "EXCLUSIVE" as const,
    supplyType: "INTRA_STATE" as const,
    packagingEnabled: true,
    packagingMethod: "PER_ORDER" as const,
    packagingAmount: 10,
    serviceChargeEnabled: true,
    serviceChargeType: "FIXED" as const,
    serviceChargeAmount: 7,
  };
  const staying = [line("a", 2, 100.4)];
  const moving = [line("b", 1, 55.55), line("c", 3, 20)];
  const discount = 15.25;
  const original = billFromStoredLines({
    items: [...staying, ...moving],
    billDiscountAmount: discount,
    billing,
  });
  const split = allocateSplitBills({
    staying,
    moving,
    billDiscountAmount: discount,
    billing,
  });
  const sum = Math.round((split.stay.total + split.move.total) * 100);
  assert.equal(sum, Math.round(original.total * 100));
});

function line(id: string, quantity: number, unit: number): OrderItemSnapshot {
  return {
    lineId: id,
    dishId: id,
    dishNameSnapshot: id,
    quantity,
    unitPriceSnapshot: unit,
    addons: [],
    itemTotal: Math.round(unit * quantity * 100) / 100,
    gstRateSnapshot: 5,
  };
}
