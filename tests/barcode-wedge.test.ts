import assert from "node:assert/strict";
import test from "node:test";
import { createBarcodeWedgeDetector, isValidBarcode } from "../lib/devices/barcode-wedge";

test("barcode wedge accepts rapid SKU scans and rejects short codes", () => {
  const scans: string[] = [];
  const det = createBarcodeWedgeDetector({ onScan: (c) => scans.push(c) });
  for (const ch of "DISH-001") {
    det.handleKeyDown({ key: ch });
  }
  const code = det.handleKeyDown({ key: "Enter", preventDefault() {} });
  assert.equal(code, "DISH-001");
  assert.deepEqual(scans, ["DISH-001"]);
  assert.equal(isValidBarcode("ab"), false);
});
