import type { KeyValueStore } from "@/lib/payments/payment-attempt";

/** One key per floor action and subject. A retry of the same attempt reuses it. */
export function floorAttemptKey(action: string, subject: string, storage?: KeyValueStore | null) {
  const name = `tronx-floor:${action}:${subject}`;
  const existing = storage?.getItem(name);
  if (existing && existing.length >= 8) return existing;
  const created = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `floor-${action}-${Math.random().toString(36).slice(2, 12)}`;
  storage?.setItem(name, created);
  return created;
}

export function clearFloorAttempt(action: string, subject: string, storage?: KeyValueStore | null) {
  storage?.removeItem(`tronx-floor:${action}:${subject}`);
}
