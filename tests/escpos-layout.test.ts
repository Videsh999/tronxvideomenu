import assert from "node:assert/strict";
import test from "node:test";
import { resolveProfile, validatePrinterConfiguration } from "../lib/devices/escpos/capabilities";
import { buildDrawerKick, buildEscPosDocument } from "../lib/devices/escpos/layout";
import { routeKotPrinter, routeReceiptPrinter } from "../lib/devices/printer-routing";
import type { DeviceRecord } from "../lib/devices/device.types";
import { HARDWARE_COMPATIBILITY_REGISTRY } from "../lib/devices/compatibility-registry";

test("58mm and 80mm profiles set charsPerLine", () => {
  assert.equal(resolveProfile({ paperWidth: 58 }).charsPerLine, 32);
  assert.equal(resolveProfile({ paperWidth: 80 }).charsPerLine, 42);
});

test("ESC/POS receipt formats totals and marks reprints", () => {
  const profile = resolveProfile({ paperWidth: 80, encoding: "ascii", brandName: "Demo" });
  const doc = buildEscPosDocument(
    {
      kind: "RECEIPT",
      orderNumber: 42,
      isReprint: true,
      items: [{ name: "Thali", qty: 2, total: 300 }],
      subtotal: 300,
      discount: 20,
      tax: 14,
      total: 294,
      paymentStatus: "PAID",
    },
    profile,
  );
  assert.ok(doc.previewLines.some((l) => l.includes("REPRINT")));
  assert.ok(doc.previewLines.some((l) => l.includes("TOTAL")));
  assert.ok(doc.bytes[0] === 0x1b);
});

test("unsupported QR capability falls back without claiming support", () => {
  const profile = resolveProfile({ capabilities: { qrCode: false } });
  const doc = buildEscPosDocument(
    { kind: "RECEIPT", orderNumber: 1, qrPayload: "order-1", total: 1, items: [] },
    profile,
  );
  assert.ok(doc.unsupported.includes("qrCode"));
  assert.ok(doc.previewLines.some((l) => l.startsWith("Ref:")));
});

test("drawer kick respects capability flag", () => {
  const on = buildDrawerKick(resolveProfile({ capabilities: { drawerKick: true } }));
  const off = buildDrawerKick(resolveProfile({ capabilities: { drawerKick: false } }));
  assert.ok(on.bytes);
  assert.equal(off.bytes, null);
});

test("printer configuration validation", () => {
  assert.deepEqual(validatePrinterConfiguration({ host: "10.0.0.5", port: 9100, paperWidth: 80 }), []);
  assert.ok(validatePrinterConfiguration({ host: "", port: 9100 }).length > 0);
});

function printer(partial: Partial<DeviceRecord>): DeviceRecord {
  return {
    id: partial.id ?? "d1",
    restaurantId: "r1",
    outletId: "r1",
    name: partial.name ?? "P",
    deviceType: partial.deviceType ?? "RECEIPT_PRINTER",
    manufacturer: "X",
    model: "Y",
    connectionType: "NETWORK",
    adapterType: partial.adapterType ?? "CONNECTOR",
    connectionStatus: partial.connectionStatus ?? "CONNECTED",
    healthStatus: "HEALTHY",
    capabilities: [],
    configuration: partial.configuration ?? { host: "10.0.0.1", port: 9100 },
    simulated: partial.simulated ?? false,
    enabled: partial.enabled ?? true,
    kitchenStation: partial.kitchenStation,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test("receipt routing prefers physical connector and warns when offline", () => {
  const route = routeReceiptPrinter([
    printer({ id: "sim", simulated: true, adapterType: "SIMULATOR", name: "Sim" }),
    printer({
      id: "phys",
      simulated: false,
      adapterType: "CONNECTOR",
      connectionStatus: "DISCONNECTED",
      name: "Net",
    }),
  ]);
  assert.equal(route.primary?.id, "phys");
  assert.ok(route.warnings.some((w) => w.includes("offline")));
});

test("kot routing uses station then MAIN fallback warning", () => {
  const route = routeKotPrinter(
    [
      printer({
        id: "main",
        deviceType: "KITCHEN_PRINTER",
        kitchenStation: "MAIN",
        name: "Main KOT",
      }),
    ],
    "BAR",
  );
  assert.equal(route.primary?.id, "main");
  assert.ok(route.warnings.some((w) => w.includes("BAR")));
});

test("compatibility registry never invents PHYSICALLY_VERIFIED", () => {
  assert.ok(
    HARDWARE_COMPATIBILITY_REGISTRY.every((p) => p.verificationStatus !== "PHYSICALLY_VERIFIED"),
  );
});
