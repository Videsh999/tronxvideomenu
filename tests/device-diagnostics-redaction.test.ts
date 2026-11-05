import assert from "node:assert/strict";
import test from "node:test";

/** Mirrors diagnostics redaction rules for unit verification without Mongo. */
function redactDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactDeep);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (
      lower.includes("secret") ||
      lower.includes("credential") ||
      lower.includes("password") ||
      lower.includes("token") ||
      lower.includes("phone") ||
      lower.includes("payment")
    ) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = redactDeep(v);
  }
  return out;
}

test("diagnostics redaction strips secrets and payment fields", () => {
  const redacted = redactDeep({
    connectorSecret: "abc",
    credentialHash: "hash",
    host: "10.0.0.5",
    customerPhone: "999",
    paymentMethod: "UPI",
    nested: { apiToken: "x", port: 9100 },
  }) as Record<string, unknown>;
  assert.equal(redacted.connectorSecret, "[redacted]");
  assert.equal(redacted.credentialHash, "[redacted]");
  assert.equal(redacted.host, "10.0.0.5");
  assert.equal(redacted.customerPhone, "[redacted]");
  assert.equal(redacted.paymentMethod, "[redacted]");
  assert.equal((redacted.nested as Record<string, unknown>).apiToken, "[redacted]");
  assert.equal((redacted.nested as Record<string, unknown>).port, 9100);
});
