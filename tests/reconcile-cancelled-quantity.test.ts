import assert from "node:assert/strict";
import test from "node:test";
import { plannedCancelledQuantity } from "../lib/billing/reconcile-cancelled-quantity";

test("stripped cancelled quantities are summed from cancellation rows", () => {
  assert.equal(
    plannedCancelledQuantity({ lineId: "line-1" }, [
      { orderLineId: "line-1", quantityCancelled: 1 },
      { orderLineId: "line-1", quantityCancelled: 2 },
      { orderLineId: "line-2", quantityCancelled: 9 },
    ]),
    3,
  );
  assert.equal(plannedCancelledQuantity({ lineId: "line-9" }, []), 0);
  assert.equal(plannedCancelledQuantity({ lineId: "line-1", cancelledQuantity: 4 }, []), null);
});
