export type UpiPaymentDetails = {
  upiId: string;
  payeeName: string;
  amount: number;
  orderNumber: string | number;
};

export function isValidUpiId(value: string) {
  return /^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9.-]{1,64}$/.test(value.trim());
}

/** Bundled merchant artwork supplied for Triparna Kitchen; dynamic provider QR remains preferred. */
export function resolveStaticMerchantQrUrl(restaurantName: string, configuredUrl?: string) {
  if (configuredUrl) return configuredUrl;
  return restaurantName.toLowerCase().includes("triparna") ? "/upi/triparna-kitchen-static.png" : undefined;
}

export function buildUpiPaymentUri(details: UpiPaymentDetails) {
  if (!isValidUpiId(details.upiId)) throw new Error("A valid UPI ID is required.");
  if (!Number.isFinite(details.amount) || details.amount <= 0) throw new Error("Payment amount must be greater than zero.");
  const params = new URLSearchParams({
    pa: details.upiId.trim(),
    pn: details.payeeName.trim() || "Restaurant",
    am: details.amount.toFixed(2),
    cu: "INR",
    tn: `Order #${details.orderNumber}`,
    tr: `TRONX-${details.orderNumber}`.slice(0, 35),
  });
  return `upi://pay?${params.toString()}`;
}
