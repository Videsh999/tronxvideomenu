import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateRestaurantBill } from "@/lib/billing/calculate-bill";
import { resolveLineTaxRate } from "@/lib/billing/resolve-tax-rate";

describe("calculateRestaurantBill", () => {
  it("applies CGST+SGST for intra-state exclusive GST", () => {
    const bill = calculateRestaurantBill({
      lines: [{ lineTotal: 1000, quantity: 1 }],
      billing: {
        gstEnabled: true,
        gstRatePercent: 5,
        priceMode: "EXCLUSIVE",
        supplyType: "INTRA_STATE",
        taxLabel: "GST",
      },
    });
    assert.equal(bill.taxAmount, 50);
    assert.equal(bill.cgstAmount, 25);
    assert.equal(bill.sgstAmount, 25);
    assert.equal(bill.igstAmount, 0);
    assert.equal(bill.total, 1050);
  });

  it("applies IGST only for inter-state", () => {
    const bill = calculateRestaurantBill({
      lines: [{ lineTotal: 1000, quantity: 1 }],
      billing: {
        gstEnabled: true,
        gstRatePercent: 5,
        priceMode: "EXCLUSIVE",
        supplyType: "INTER_STATE",
      },
    });
    assert.equal(bill.igstAmount, 50);
    assert.equal(bill.cgstAmount, 0);
    assert.equal(bill.sgstAmount, 0);
  });

  it("extracts tax for inclusive prices without stacking", () => {
    const bill = calculateRestaurantBill({
      lines: [{ lineTotal: 1050, quantity: 1 }],
      billing: {
        gstEnabled: true,
        gstRatePercent: 5,
        priceMode: "INCLUSIVE",
        supplyType: "INTRA_STATE",
      },
    });
    assert.equal(bill.total, 1050);
    assert.equal(bill.taxAmount, 50);
    assert.equal(bill.taxableAmount, 1000);
  });

  it("disables GST when gstEnabled is false", () => {
    const bill = calculateRestaurantBill({
      lines: [{ lineTotal: 500, quantity: 1 }],
      billing: { gstEnabled: false, gstRatePercent: 18, taxRatePercent: 18 },
    });
    assert.equal(bill.taxAmount, 0);
    assert.equal(bill.total, 500);
  });

  it("adds packaging per order once", () => {
    const bill = calculateRestaurantBill({
      lines: [
        { lineTotal: 200, quantity: 2 },
        { lineTotal: 100, quantity: 1 },
      ],
      billing: {
        gstEnabled: false,
        packagingEnabled: true,
        packagingMethod: "PER_ORDER",
        packagingAmount: 20,
      },
    });
    assert.equal(bill.packagingCharge, 20);
    assert.equal(bill.total, 320);
  });

  it("adds packaging per quantity", () => {
    const bill = calculateRestaurantBill({
      lines: [{ lineTotal: 100, quantity: 3 }],
      billing: {
        gstEnabled: false,
        packagingEnabled: true,
        packagingMethod: "PER_QUANTITY",
        packagingAmount: 10,
      },
      quantityCount: 3,
    });
    assert.equal(bill.packagingCharge, 30);
  });

  it("adds percentage service charge when enabled", () => {
    const bill = calculateRestaurantBill({
      lines: [{ lineTotal: 1000, quantity: 1 }],
      billing: {
        gstEnabled: false,
        serviceChargeEnabled: true,
        serviceChargeType: "PERCENT",
        serviceChargePercent: 10,
      },
    });
    assert.equal(bill.serviceCharge, 100);
    assert.equal(bill.total, 1100);
  });

  it("does not add service charge when disabled", () => {
    const bill = calculateRestaurantBill({
      lines: [{ lineTotal: 1000, quantity: 1 }],
      billing: {
        gstEnabled: false,
        serviceChargeEnabled: false,
        serviceChargePercent: 10,
      },
    });
    assert.equal(bill.serviceCharge, 0);
    assert.equal(bill.total, 1000);
  });

  it("rejects discount above subtotal", () => {
    assert.throws(() =>
      calculateRestaurantBill({
        lines: [{ lineTotal: 100, quantity: 1 }],
        billDiscountAmount: 150,
        billing: { gstEnabled: false },
      }),
    );
  });

  it("example: ₹1000 + ₹20 packaging + ₹50 service + 5% GST exclusive", () => {
    const bill = calculateRestaurantBill({
      lines: [{ lineTotal: 1000, quantity: 1 }],
      billing: {
        gstEnabled: true,
        gstRatePercent: 5,
        priceMode: "EXCLUSIVE",
        supplyType: "INTRA_STATE",
        packagingEnabled: true,
        packagingMethod: "PER_ORDER",
        packagingAmount: 20,
        serviceChargeEnabled: true,
        serviceChargeType: "FIXED",
        serviceChargeAmount: 50,
      },
    });
    assert.equal(bill.itemsSubtotal, 1000);
    assert.equal(bill.packagingCharge, 20);
    assert.equal(bill.serviceCharge, 50);
    assert.equal(bill.taxableAmount, 1070);
    assert.equal(bill.taxAmount, 53.5);
    assert.equal(bill.total, 1123.5);
  });
});

describe("resolveLineTaxRate", () => {
  it("prefers dish override over category and outlet", () => {
    const resolved = resolveLineTaxRate({
      dish: { taxRatePercent: 12 },
      category: { taxRatePercent: 5 },
      billing: { gstEnabled: true, gstRatePercent: 18 },
    });
    assert.equal(resolved.rate, 12);
    assert.equal(resolved.source, "DISH");
  });

  it("falls back to category then outlet", () => {
    const category = resolveLineTaxRate({
      dish: { taxRatePercent: null },
      category: { taxRatePercent: 5 },
      billing: { gstEnabled: true, gstRatePercent: 18 },
    });
    assert.equal(category.source, "CATEGORY");
    const outlet = resolveLineTaxRate({
      dish: {},
      category: {},
      billing: { gstEnabled: true, gstRatePercent: 18 },
    });
    assert.equal(outlet.source, "OUTLET");
    assert.equal(outlet.rate, 18);
  });
});
