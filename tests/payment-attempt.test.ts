import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { paymentAttemptKey, clearPaymentAttempt, type KeyValueStore } from "../lib/payments/payment-attempt";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => { data.set(key, value); },
    removeItem: (key) => { data.delete(key); },
  };
}

test("a payment attempt keeps its key until the response is accepted", () => {
  const store = memoryStore();
  const first = paymentAttemptKey("order-1", store);
  const retry = paymentAttemptKey("order-1", store);
  assert.equal(retry, first);
  clearPaymentAttempt("order-1", store);
  const next = paymentAttemptKey("order-1", store);
  assert.notEqual(next, first);
});
