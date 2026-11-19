/**
 * One idempotency key per payment attempt. A retry of the same attempt reuses it,
 * including when the server committed and the response was lost.
 */
export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function paymentStorageKey(orderId: string) {
  return `tronx-payment:${orderId}`;
}

export function paymentAttemptKey(orderId: string, storage?: KeyValueStore | null): string {
  const name = paymentStorageKey(orderId);
  const existing = storage?.getItem(name);
  if (existing && existing.length >= 8) return existing;
  const created = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `pay-${orderId}-${Math.random().toString(36).slice(2, 12)}`;
  storage?.setItem(name, created);
  return created;
}

export function clearPaymentAttempt(orderId: string, storage?: KeyValueStore | null) {
  storage?.removeItem(paymentStorageKey(orderId));
}

export function browserPaymentStore(): KeyValueStore | null {
  try {
    if (typeof sessionStorage === "undefined") return null;
    return sessionStorage;
  } catch {
    return null;
  }
}
