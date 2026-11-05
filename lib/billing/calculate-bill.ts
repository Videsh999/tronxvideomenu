/**
 * Authoritative restaurant billing calculator.
 * Used by POS, Captain, QR, and Admin preview — never duplicate formulas in frontends.
 */
import type { BillBreakdown, RestaurantBillingSettings, TaxPriceMode } from "@/types";
import { roundMoney } from "@/lib/order-pricing";

export type BillingLineInput = {
  lineTotal: number;
  quantity: number;
  /** Optional per-line GST override (dish/category). */
  gstRatePercent?: number;
};

export type CalculateBillInput = {
  lines: BillingLineInput[];
  billDiscountAmount?: number;
  billing?: RestaurantBillingSettings | null;
  /** When packaging PER_ITEM / PER_QUANTITY needs counts */
  itemCount?: number;
  quantityCount?: number;
};

export function resolveOutletGstRate(billing?: RestaurantBillingSettings | null): number {
  if (!billing) return 0;
  if (billing.gstEnabled === false) return 0;
  if (billing.gstEnabled === true) {
    return Math.max(0, Math.min(100, billing.gstRatePercent ?? billing.taxRatePercent ?? 0));
  }
  return Math.max(0, Math.min(100, billing.taxRatePercent ?? 0));
}

function packagingCharge(
  billing: RestaurantBillingSettings | null | undefined,
  itemsSubtotal: number,
  itemCount: number,
  quantityCount: number,
): number {
  if (!billing?.packagingEnabled) return 0;
  const amount = Math.max(0, billing.packagingAmount ?? 0);
  const percent = Math.max(0, billing.packagingPercent ?? 0);
  switch (billing.packagingMethod ?? "PER_ORDER") {
    case "PER_ORDER":
      return roundMoney(amount);
    case "PER_ITEM":
      return roundMoney(amount * Math.max(0, itemCount));
    case "PER_QUANTITY":
      return roundMoney(amount * Math.max(0, quantityCount));
    case "PERCENT_OF_SUBTOTAL":
      return roundMoney((itemsSubtotal * percent) / 100);
    default:
      return 0;
  }
}

function serviceCharge(
  billing: RestaurantBillingSettings | null | undefined,
  base: number,
): number {
  if (!billing?.serviceChargeEnabled) return 0;
  if ((billing.serviceChargeType ?? "PERCENT") === "FIXED") {
    return roundMoney(Math.max(0, billing.serviceChargeAmount ?? 0));
  }
  return roundMoney((base * Math.max(0, billing.serviceChargePercent ?? 0)) / 100);
}

function splitGst(
  taxAmount: number,
  supplyType: RestaurantBillingSettings["supplyType"],
) {
  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;
  if (taxAmount > 0) {
    if (supplyType === "INTER_STATE") {
      igstAmount = taxAmount;
    } else {
      cgstAmount = roundMoney(taxAmount / 2);
      sgstAmount = roundMoney(taxAmount - cgstAmount);
    }
  }
  return { cgstAmount, sgstAmount, igstAmount };
}

/**
 * Compute full bill breakdown from line totals + restaurant billing settings.
 * Tax-inclusive: extract tax from taxable portion. Exclusive: add tax on top.
 * Intra-state: split GST into CGST+SGST. Inter-state: IGST only. Never all three.
 *
 * When lines carry different gstRatePercent values, tax is computed per-line on a
 * proportional share of the post-discount/packaging/service base.
 */
export function calculateRestaurantBill(input: CalculateBillInput): BillBreakdown {
  const billing = input.billing ?? {};
  const priceMode: TaxPriceMode = billing.priceMode ?? "EXCLUSIVE";
  const itemsSubtotal = roundMoney(input.lines.reduce((sum, line) => sum + line.lineTotal, 0));
  const billDiscount = Math.max(0, input.billDiscountAmount ?? 0);
  if (billDiscount > itemsSubtotal) {
    throw new Error("Bill discount cannot exceed the subtotal.");
  }

  const itemCount = input.itemCount ?? input.lines.length;
  const quantityCount =
    input.quantityCount ?? input.lines.reduce((sum, line) => sum + Math.max(0, line.quantity), 0);

  const afterDiscount = roundMoney(itemsSubtotal - billDiscount);
  const packaging = packagingCharge(billing, afterDiscount, itemCount, quantityCount);
  const service = serviceCharge(billing, afterDiscount + packaging);
  const preTaxBase = roundMoney(afterDiscount + packaging + service);

  const outletRate = resolveOutletGstRate(billing);
  const supplyType = billing.supplyType ?? "INTRA_STATE";
  const taxLabel = billing.taxLabel?.trim() || (outletRate > 0 || input.lines.some((l) => (l.gstRatePercent ?? 0) > 0) ? "GST" : "Tax");

  const lineRates = input.lines.map((line) =>
    line.gstRatePercent != null ? Math.max(0, Math.min(100, line.gstRatePercent)) : outletRate,
  );
  const uniqueRates = [...new Set(lineRates)];
  const uniformRate = uniqueRates.length <= 1 ? (uniqueRates[0] ?? outletRate) : null;

  let taxableAmount = preTaxBase;
  let taxAmount = 0;

  if (uniformRate != null) {
    if (uniformRate > 0) {
      if (priceMode === "INCLUSIVE") {
        taxableAmount = roundMoney(preTaxBase / (1 + uniformRate / 100));
        taxAmount = roundMoney(preTaxBase - taxableAmount);
      } else {
        taxableAmount = preTaxBase;
        taxAmount = roundMoney((taxableAmount * uniformRate) / 100);
      }
    }
  } else if (itemsSubtotal > 0 && preTaxBase > 0) {
    // Mixed rates: allocate preTaxBase proportionally to line totals, tax each slice.
    let taxableSum = 0;
    let taxSum = 0;
    for (let i = 0; i < input.lines.length; i += 1) {
      const share = input.lines[i].lineTotal / itemsSubtotal;
      const slice = roundMoney(preTaxBase * share);
      const rate = lineRates[i] ?? 0;
      if (rate <= 0) {
        taxableSum += slice;
        continue;
      }
      if (priceMode === "INCLUSIVE") {
        const taxable = roundMoney(slice / (1 + rate / 100));
        taxableSum += taxable;
        taxSum += roundMoney(slice - taxable);
      } else {
        taxableSum += slice;
        taxSum += roundMoney((slice * rate) / 100);
      }
    }
    taxableAmount = roundMoney(taxableSum);
    taxAmount = roundMoney(taxSum);
  }

  const { cgstAmount, sgstAmount, igstAmount } = splitGst(taxAmount, supplyType);

  const total =
    priceMode === "INCLUSIVE" && taxAmount > 0
      ? preTaxBase
      : roundMoney(preTaxBase + taxAmount);

  return {
    itemsSubtotal,
    billDiscount,
    packagingCharge: packaging,
    serviceCharge: service,
    taxableAmount,
    taxAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    taxLabel,
    gstRatePercent: uniformRate ?? outletRate,
    supplyType,
    priceMode,
    total,
  };
}

/** Bridge for legacy computeBillTotals callers — maps into calculateRestaurantBill. */
export function billFromLegacyTaxRate(
  lineTotals: number[],
  billDiscountAmount: number | undefined,
  taxRatePercent: number | undefined,
): BillBreakdown {
  return calculateRestaurantBill({
    lines: lineTotals.map((lineTotal) => ({ lineTotal, quantity: 1 })),
    billDiscountAmount,
    billing: {
      taxRatePercent: taxRatePercent ?? 0,
      gstEnabled: (taxRatePercent ?? 0) > 0 ? true : false,
      gstRatePercent: taxRatePercent ?? 0,
      priceMode: "EXCLUSIVE",
      supplyType: "INTRA_STATE",
      taxLabel: "GST",
    },
  });
}
