import assert from "node:assert/strict";
import test from "node:test";
import { stripCaptainOrder } from "../lib/captain/pii";

test("captain orders keep a first name and drop contact details", () => {
  const safe = stripCaptainOrder({
    id: "order-1",
    customerName: "Asha Rao",
    customerPhone: "9999999999",
    customerEmail: "asha@example.com",
    deliveryAddress: "12 Lake Road",
    orderNote: "Call 9999999999 or asha@example.com",
  });
  assert.equal(safe.customerName, "Asha");
  assert.equal("customerPhone" in safe, false);
  assert.equal("customerEmail" in safe, false);
  assert.equal("deliveryAddress" in safe, false);
  assert.equal(safe.orderNote?.includes("9999999999"), false);
  assert.equal(safe.orderNote?.includes("asha@example.com"), false);
});
