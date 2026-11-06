import type { Captain, CaptainPermissions, PaymentMethod } from "@/types";

/** Defaults keep existing captains operational after the permissions field is introduced. */
export const DEFAULT_CAPTAIN_PERMISSIONS: Required<CaptainPermissions> = {
  viewBill: true,
  requestBill: true,
  recordCashPayment: true,
  recordUpiPayment: true,
  recordCardPayment: true,
  applyCoupon: true,
  applyDiscount: true,
  printReceipt: true,
  maxDiscountPercent: 25,
  maxDiscountAmount: 500,
};

export function resolveCaptainPermissions(
  captain: Pick<Captain, "permissions"> | null | undefined,
): Required<CaptainPermissions> {
  const raw = captain?.permissions ?? {};
  return {
    viewBill: raw.viewBill ?? DEFAULT_CAPTAIN_PERMISSIONS.viewBill,
    requestBill: raw.requestBill ?? DEFAULT_CAPTAIN_PERMISSIONS.requestBill,
    recordCashPayment: raw.recordCashPayment ?? DEFAULT_CAPTAIN_PERMISSIONS.recordCashPayment,
    recordUpiPayment: raw.recordUpiPayment ?? DEFAULT_CAPTAIN_PERMISSIONS.recordUpiPayment,
    recordCardPayment: raw.recordCardPayment ?? DEFAULT_CAPTAIN_PERMISSIONS.recordCardPayment,
    applyCoupon: raw.applyCoupon ?? DEFAULT_CAPTAIN_PERMISSIONS.applyCoupon,
    applyDiscount: raw.applyDiscount ?? DEFAULT_CAPTAIN_PERMISSIONS.applyDiscount,
    printReceipt: raw.printReceipt ?? DEFAULT_CAPTAIN_PERMISSIONS.printReceipt,
    maxDiscountPercent: raw.maxDiscountPercent ?? DEFAULT_CAPTAIN_PERMISSIONS.maxDiscountPercent,
    maxDiscountAmount: raw.maxDiscountAmount ?? DEFAULT_CAPTAIN_PERMISSIONS.maxDiscountAmount,
  };
}

export function captainMayRecordPayment(
  permissions: Required<CaptainPermissions>,
  method: PaymentMethod,
): boolean {
  if (method === "CASH") return permissions.recordCashPayment;
  if (method === "UPI") return permissions.recordUpiPayment;
  if (method === "CARD") return permissions.recordCardPayment;
  return false;
}

export function assertCaptainDiscountAllowed(
  permissions: Required<CaptainPermissions>,
  billDiscountAmount: number,
  itemsSubtotal: number,
): void {
  if (billDiscountAmount <= 0) return;
  if (!permissions.applyDiscount) {
    throw new Error("This captain is not permitted to apply bill discounts.");
  }
  if (billDiscountAmount > permissions.maxDiscountAmount) {
    throw new Error(
      `Discount exceeds captain limit of ${permissions.maxDiscountAmount.toFixed(2)}.`,
    );
  }
  if (itemsSubtotal > 0) {
    const percent = (billDiscountAmount / itemsSubtotal) * 100;
    if (percent > permissions.maxDiscountPercent + 1e-6) {
      throw new Error(
        `Discount exceeds captain limit of ${permissions.maxDiscountPercent}% of subtotal.`,
      );
    }
  }
}
