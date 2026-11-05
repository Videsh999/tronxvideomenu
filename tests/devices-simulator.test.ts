import assert from "node:assert/strict";
import test from "node:test";
import { ensureSimulatorAdaptersRegistered } from "../lib/devices/adapters/simulator";
import { resetAllSimulatorRuntime } from "../lib/devices/adapters/simulator/simulator-state";
import { resolveDeviceAdapter, listRegisteredAdapterKeys } from "../lib/devices/device-registry";
import { buildPrintDedupeKey, createPrintJobDraft, isRecoverablePrintError } from "../lib/devices/device-jobs";
import { buildSampleSimulatorDevices } from "../lib/devices/sample-devices";
import { runDeviceCommand } from "../lib/devices/device-manager";
import { hasRestaurantFeature } from "../lib/features";
import { roleHasPermission } from "../lib/org-rbac";
import type { DeviceRecord } from "../lib/devices/device.types";

function sampleDevice(overrides: Partial<DeviceRecord> = {}): DeviceRecord {
  const base = buildSampleSimulatorDevices({
    restaurantId: "r1",
    outletId: "r1",
  })[0]!;
  return { ...base, ...overrides };
}

test("simulator adapters register for all device types", () => {
  ensureSimulatorAdaptersRegistered();
  const keys = listRegisteredAdapterKeys();
  assert.ok(keys.includes("SIMULATOR::RECEIPT_PRINTER"));
  assert.ok(keys.includes("SIMULATOR::KITCHEN_PRINTER"));
  assert.ok(keys.includes("SIMULATOR::CASH_DRAWER"));
  assert.ok(keys.includes("SIMULATOR::BARCODE_SCANNER"));
  assert.ok(keys.includes("SIMULATOR::PAYMENT_TERMINAL"));
  assert.ok(keys.includes("SIMULATOR::CUSTOMER_DISPLAY"));
  assert.ok(resolveDeviceAdapter("SIMULATOR", "RECEIPT_PRINTER"));
});

test("sample devices are all labelled simulated", () => {
  const samples = buildSampleSimulatorDevices({ restaurantId: "r-a", outletId: "out-a" });
  assert.ok(samples.length >= 6);
  assert.ok(samples.every((d) => d.simulated && d.adapterType === "SIMULATOR"));
  assert.ok(samples.every((d) => d.restaurantId === "r-a"));
});

test("device tenant fields differ across restaurants", () => {
  const a = buildSampleSimulatorDevices({ restaurantId: "r-a", outletId: "o-a" });
  const b = buildSampleSimulatorDevices({ restaurantId: "r-b", outletId: "o-b" });
  assert.notEqual(a[0]!.restaurantId, b[0]!.restaurantId);
});

test("receipt printer success and failure paths", async () => {
  resetAllSimulatorRuntime();
  ensureSimulatorAdaptersRegistered();
  const device = sampleDevice({ deviceType: "RECEIPT_PRINTER", name: "R1" });
  const ok = await runDeviceCommand(device, {
    name: "PRINT",
    payload: { orderNumber: 1, items: [{ name: "Tea", qty: 1, total: 20 }], total: 20 },
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.simulated, true);
  assert.ok(String(ok.data?.preview && (ok.data.preview as { simulatedBanner: string }).simulatedBanner).includes("SIMULATED"));

  await runDeviceCommand(device, { name: "SIMULATE_PAPER_OUT" });
  const paper = await runDeviceCommand(device, { name: "PRINT", payload: { orderNumber: 2 } });
  assert.equal(paper.ok, false);
  assert.equal(paper.errorCode, "PAPER_OUT");

  await runDeviceCommand(device, { name: "SIMULATE_RECOVER" });
  await runDeviceCommand(device, { name: "SIMULATE_PRINT_FAIL" });
  const fail = await runDeviceCommand(device, { name: "PRINT", payload: { orderNumber: 3 } });
  assert.equal(fail.ok, false);
  assert.equal(fail.errorCode, "PRINT_FAIL");
});

test("kitchen printer includes station routing payload", async () => {
  resetAllSimulatorRuntime();
  const device = sampleDevice({
    deviceType: "KITCHEN_PRINTER",
    kitchenStation: "BAR",
    name: "Bar printer",
  });
  const result = await runDeviceCommand(device, {
    name: "PRINT",
    payload: { orderNumber: 9, station: "BAR", items: [{ name: "Beer", qty: 1 }] },
  });
  assert.equal(result.ok, true);
  assert.equal(result.data?.station, "BAR");
});

test("cash drawer rejects unauthorized open", async () => {
  resetAllSimulatorRuntime();
  const device = sampleDevice({ deviceType: "CASH_DRAWER" });
  const denied = await runDeviceCommand(device, { name: "OPEN_DRAWER", payload: { authorized: false } });
  assert.equal(denied.ok, false);
  assert.equal(denied.errorCode, "UNAUTHORIZED");
  const allowed = await runDeviceCommand(device, { name: "OPEN_DRAWER", payload: { authorized: true } });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.data?.physical, false);
});

test("barcode scanner does not change stock", async () => {
  resetAllSimulatorRuntime();
  const device = sampleDevice({ deviceType: "BARCODE_SCANNER" });
  const unknown = await runDeviceCommand(device, { name: "SCAN", payload: { barcode: "XYZ-999" } });
  assert.equal(unknown.ok, true);
  assert.equal(unknown.data?.found, false);
  assert.equal(unknown.data?.stockChanged, false);
  const known = await runDeviceCommand(device, {
    name: "SCAN",
    payload: { barcode: "ING-1", lookupResult: { name: "Rice" } },
  });
  assert.equal(known.data?.stockChanged, false);
});

test("payment terminal never claims ledger settlement", async () => {
  resetAllSimulatorRuntime();
  const device = sampleDevice({ deviceType: "PAYMENT_TERMINAL" });
  const approved = await runDeviceCommand(device, {
    name: "PAYMENT_REQUEST",
    payload: { amount: 50, outcome: "APPROVED", callbackId: "cb-1" },
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.data?.contaminatesLedger, false);
  assert.equal(approved.data?.settlement, "NONE");
  assert.equal(approved.simulated, true);

  const dup = await runDeviceCommand(device, {
    name: "PAYMENT_REQUEST",
    payload: { amount: 50, outcome: "APPROVED", callbackId: "cb-1" },
  });
  assert.equal(dup.ok, false);
  assert.equal(dup.errorCode, "DUPLICATE_CALLBACK");

  const declined = await runDeviceCommand(device, {
    name: "PAYMENT_REQUEST",
    payload: { amount: 50, outcome: "DECLINED", callbackId: "cb-2" },
  });
  assert.equal(declined.data?.result, "DECLINED");
});

test("customer display uses POS calculation fields", async () => {
  resetAllSimulatorRuntime();
  const device = sampleDevice({ deviceType: "CUSTOMER_DISPLAY" });
  const result = await runDeviceCommand(device, {
    name: "DISPLAY_UPDATE",
    payload: {
      items: [{ name: "Dosa", qty: 2 }],
      subtotal: 200,
      discount: 20,
      tax: 9,
      total: 189,
      paymentStatus: "PARTIAL",
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data?.totals, { subtotal: 200, discount: 20, tax: 9, total: 189 });
});

test("print dedupe keys prevent duplicate non-reprint jobs", () => {
  const a = buildPrintDedupeKey({
    restaurantId: "r1",
    orderId: "o1",
    jobType: "KOT",
    station: "MAIN",
  });
  const b = buildPrintDedupeKey({
    restaurantId: "r1",
    orderId: "o1",
    jobType: "KOT",
    station: "MAIN",
  });
  assert.equal(a, b);
  const reprint = buildPrintDedupeKey({
    restaurantId: "r1",
    orderId: "o1",
    jobType: "REPRINT_KOT",
    station: "MAIN",
    isReprint: true,
    reprintNonce: "n1",
  });
  assert.notEqual(a, reprint);
  const draft = createPrintJobDraft({
    restaurantId: "r1",
    outletId: "r1",
    deviceId: "d1",
    orderId: "o1",
    jobType: "RECEIPT",
    dedupeKey: a,
    payloadSnapshot: {},
    simulated: true,
  });
  assert.equal(draft.status, "QUEUED");
  assert.equal(draft.simulated, true);
  assert.equal(isRecoverablePrintError("PAPER_OUT"), true);
  assert.equal(isRecoverablePrintError("UNAUTHORIZED"), false);
});

test("disconnect and recover update simulator health", async () => {
  resetAllSimulatorRuntime();
  const device = sampleDevice({ deviceType: "RECEIPT_PRINTER" });
  const adapter = resolveDeviceAdapter("SIMULATOR", "RECEIPT_PRINTER")!;
  await adapter.disconnect(device);
  const offline = await adapter.healthCheck(device);
  assert.equal(offline.ok, false);
  await adapter.connect(device);
  const healthy = await adapter.healthCheck(device);
  assert.equal(healthy.ok, true);
});

test("HARDWARE flags are ENTERPRISE and device manage permission is gated", () => {
  assert.equal(hasRestaurantFeature({ subscriptionPlan: "PRO" }, "HARDWARE_SIMULATOR"), false);
  assert.equal(hasRestaurantFeature({ subscriptionPlan: "ENTERPRISE" }, "HARDWARE_SIMULATOR"), true);
  assert.equal(hasRestaurantFeature({ subscriptionPlan: "ENTERPRISE" }, "HARDWARE_PRINTING"), true);
  assert.equal(roleHasPermission("OUTLET_STAFF", "OUTLET_DEVICES_MANAGE"), false);
  assert.equal(roleHasPermission("OUTLET_MANAGER", "OUTLET_DEVICES_MANAGE"), true);
});
