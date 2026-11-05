import assert from "node:assert/strict";
import test from "node:test";
import { createWedgeDetector, isValidBarcode } from "../src/barcode/wedge.ts";
import {
  buildDocumentBytes,
  buildDrawerKickBytes,
  buildReceiptBytes,
  payloadHash,
  validatePrinterConfig,
} from "../src/printers/escpos.ts";
import { UnsupportedUsbPrinterAdapter } from "../src/printers/usb-adapter.ts";

test("receipt bytes include init and capability-gated cut", () => {
  const buf = buildReceiptBytes(
    {
      orderNumber: 12,
      items: [{ name: "Tea", qty: 1, total: 20 }],
      total: 20,
    },
    { host: "10.0.0.1", port: 9100, paperWidth: 80 },
  );
  assert.ok(buf.length > 20);
  assert.equal(buf[0], 0x1b);
  assert.equal(buf[1], 0x40);
});

test("58mm and 80mm layouts differ in line width markers", () => {
  const a = buildDocumentBytes(
    "RECEIPT",
    { orderNumber: 1, items: [{ name: "Long item name here", qty: 1, total: 9 }], total: 9 },
    { host: "1.1.1.1", port: 9100, paperWidth: 58 },
  );
  const b = buildDocumentBytes(
    "RECEIPT",
    { orderNumber: 1, items: [{ name: "Long item name here", qty: 1, total: 9 }], total: 9 },
    { host: "1.1.1.1", port: 9100, paperWidth: 80 },
  );
  assert.ok(a.bytes.includes(Buffer.from("Width 58mm")[0]!));
  assert.notEqual(a.bytes.length, b.bytes.length);
});

test("unsupported qr falls back to text ref", () => {
  const doc = buildDocumentBytes(
    "RECEIPT",
    { orderNumber: 1, qrPayload: "abc", total: 1, items: [] },
    { host: "1.1.1.1", port: 9100, capabilities: { qrCode: false } },
  );
  assert.ok(doc.unsupported.includes("qrCode"));
});

test("drawer kick uses ESC p when enabled", () => {
  const buf = buildDrawerKickBytes({ host: "1.1.1.1", port: 9100 });
  assert.ok(buf);
  assert.deepEqual([...buf!.slice(0, 3)], [0x1b, 0x70, 0x00]);
  assert.equal(buildDrawerKickBytes({ host: "1.1.1.1", port: 9100, capabilities: { drawerKick: false } }), null);
});

test("printer config validation", () => {
  assert.ok(validatePrinterConfig({ host: "" }));
  assert.equal(validatePrinterConfig({ host: "10.0.0.5", port: 9100, paperWidth: 80 }), null);
  assert.ok(validatePrinterConfig({ host: "10.0.0.5", paperWidth: 70 }));
});

test("payload hash is stable", () => {
  const a = payloadHash({ total: 1, items: [] });
  const b = payloadHash({ total: 1, items: [] });
  assert.equal(a, b);
});

test("barcode wedge detects rapid Enter-terminated input", () => {
  const scans: string[] = [];
  const det = createWedgeDetector({ onScan: (c) => scans.push(c), windowMs: 50 });
  for (const ch of "SKU-12345") det.pushKey(ch);
  const code = det.pushKey("Enter");
  assert.equal(code, "SKU-12345");
  assert.deepEqual(scans, ["SKU-12345"]);
  assert.equal(isValidBarcode("x"), false);
});

test("USB adapter honestly reports unsupported", async () => {
  const usb = new UnsupportedUsbPrinterAdapter();
  assert.equal((await usb.listPrinters()).length, 0);
  const testPrint = await usb.testPrint();
  assert.equal(testPrint.ok, false);
});
