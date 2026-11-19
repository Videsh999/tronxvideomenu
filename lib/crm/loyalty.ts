import { roundMoney } from "@/lib/order-pricing";

export function earnPointsForOrder(params: {
  orderTotal: number;
  pointsPerCurrencyUnit?: number;
}): number {
  const rate = params.pointsPerCurrencyUnit ?? 1;
  if (rate <= 0 || params.orderTotal <= 0) return 0;
  return Math.floor(params.orderTotal * rate);
}

export function redeemPointsValue(params: {
  points: number;
  currencyPerPoint?: number;
}): number {
  const rate = params.currencyPerPoint ?? 0.1;
  if (params.points <= 0 || rate <= 0) return 0;
  return roundMoney(params.points * rate);
}

export function loyaltyEarnKey(orderId: string): string {
  return `loyalty-earn:${orderId}`;
}

export function loyaltyRedeemKey(orderId: string, couponId: string): string {
  return `loyalty-redeem:${orderId}:${couponId}`;
}

/** Idempotency key for coupon reservation tied to a specific order. */
export function couponRedeemKey(orderId: string, couponCode: string): string {
  return `coupon-redeem:${orderId}:${couponCode.trim().toUpperCase()}`;
}

export function applyCouponDiscount(params: {
  orderTotal: number;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  minOrderTotal?: number;
}): { discount: number; payable: number } {
  if (params.minOrderTotal != null && params.orderTotal < params.minOrderTotal) {
    throw new Error("Order total is below the coupon minimum.");
  }
  const percent = Math.min(Math.max(params.discountValue, 0), 100);
  const discount =
    params.discountType === "PERCENT"
      ? roundMoney((params.orderTotal * percent) / 100)
      : roundMoney(Math.min(Math.max(params.discountValue, 0), params.orderTotal));
  const payable = Math.max(0, roundMoney(params.orderTotal - discount));
  return { discount, payable };
}
