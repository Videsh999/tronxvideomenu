import assert from "node:assert/strict";
import test from "node:test";
import {
  equalSplitAmounts,
  formatOccupiedDuration,
  formatRupeeTotal,
  groupTablesBySection,
  kotItemStatus,
  nextKotNumber,
  partitionBillItems,
  runningBillFromServer,
} from "../lib/captain-floor";

test("occupied duration is minutes, then h:mm", () => {
  const opened = "2026-11-10T06:00:00.000Z";
  const start = new Date(opened).getTime();
  assert.equal(formatOccupiedDuration(opened, start + 12 * 60000), "12m");
  assert.equal(formatOccupiedDuration(opened, start + 65 * 60000), "1:05");
  assert.equal(formatOccupiedDuration(undefined, start), "—");
});

test("rupee total and server bill use stored amounts", () => {
  assert.equal(formatRupeeTotal(120.4), "₹120");
  assert.equal(formatRupeeTotal(1500), "₹1,500");
  const bill = runningBillFromServer({
    subtotal: 200,
    cgstAmount: 5,
    sgstAmount: 5,
    igstAmount: 0,
    total: 220,
  });
  assert.deepEqual(bill, { subtotal: 200, tax: 10, total: 220 });
  assert.equal(formatRupeeTotal(bill.total), "₹220");
});

test("tables group by area and new KOT numbers follow the previous ticket", () => {
  const groups = groupTablesBySection([
    { tableNumber: 2, area: "Terrace" },
    { tableNumber: 1, area: "Indoor" },
    { tableNumber: 3 },
  ]);
  assert.deepEqual(
    groups.map((group) => [group.name, group.tables.map((table) => table.tableNumber)]),
    [
      ["Terrace", [2]],
      ["Indoor", [1]],
      ["Floor", [3]],
    ],
  );
  assert.equal(nextKotNumber([]), 1);
  assert.equal(nextKotNumber([{ kotNumber: 1 }, { kotNumber: 2 }]), 3);
  assert.equal(nextKotNumber([{}]), 2);
});

test("KOT status comes from kitchen data and stays sent until the kitchen moves it", () => {
  assert.equal(kotItemStatus({}), "sent");
  assert.equal(kotItemStatus({ preparationStatus: "QUEUED" }), "sent");
  assert.equal(kotItemStatus({ preparationStatus: "PREPARING" }), "preparing");
  assert.equal(kotItemStatus({ preparationStatus: "READY" }), "ready");
  assert.equal(kotItemStatus({ preparationStatus: "READY" }, "SERVED"), "served");
});

test("equal shares add back to the server total", () => {
  const shares = equalSplitAmounts(100, 3);
  assert.deepEqual(shares, [33.34, 33.33, 33.33]);
  assert.equal(
    shares.reduce((sum, share) => sum + share, 0).toFixed(2),
    "100.00",
  );
  assert.throws(() => equalSplitAmounts(10, 1), /2 to 20/);
});

test("an item split keeps items on both bills", () => {
  const items = [
    { lineId: "a", quantity: 1, cancelledQuantity: 0 },
    { lineId: "b", quantity: 2, cancelledQuantity: 0 },
  ];
  const parts = partitionBillItems(items, ["b"]);
  assert.deepEqual(parts.moving.map((item) => item.lineId), ["b"]);
  assert.deepEqual(parts.staying.map((item) => item.lineId), ["a"]);
  assert.throws(() => partitionBillItems(items, ["a", "b"]), /at least one item/);
});
