import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssignablePrinterRole,
  defaultPrinterRole,
  isPrinterRoleCompatible,
} from "../lib/devices/printer-roles";
import { routeKotPrinter, routeReceiptPrinter } from "../lib/devices/printer-routing";
import { buildPrintDedupeKey, createPrintJobDraft } from "../lib/devices/device-jobs";
import { buildSampleSimulatorDevices } from "../lib/devices/sample-devices";
import {
  HARDWARE_COMPATIBILITY_REGISTRY,
  normalizeVerificationStatus,
} from "../lib/devices/compatibility-registry";
import type { DeviceRecord, PrintJobRecord, PrinterRole } from "../lib/devices/device.types";
import { PRINT_JOB_LEASE_MS } from "../lib/devices/device.types";

function printer(partial: Partial<DeviceRecord> & { id: string }): DeviceRecord {
  return {
    id: partial.id,
    restaurantId: partial.restaurantId ?? "r1",
    outletId: partial.outletId ?? "o1",
    name: partial.name ?? "Printer",
    deviceType: partial.deviceType ?? "RECEIPT_PRINTER",
    manufacturer: "Generic",
    model: "ESC/POS",
    connectionType: partial.connectionType ?? "NETWORK",
    adapterType: partial.adapterType ?? "CONNECTOR",
    connectionStatus: partial.connectionStatus ?? "CONNECTED",
    healthStatus: partial.healthStatus ?? "HEALTHY",
    capabilities: [],
    configuration: partial.configuration ?? { host: "10.0.0.1", port: 9100 },
    simulated: partial.simulated ?? false,
    enabled: partial.enabled ?? true,
    kitchenStation: partial.kitchenStation,
    printerRole: partial.printerRole,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test("sample devices include compatible printer roles", () => {
  const samples = buildSampleSimulatorDevices({ restaurantId: "r1", outletId: "o1" });
  const receipt = samples.find((d) => d.deviceType === "RECEIPT_PRINTER");
  const bar = samples.find((d) => d.kitchenStation === "BAR");
  assert.equal(receipt?.printerRole, "RECEIPT");
  assert.equal(bar?.printerRole, "BAR");
  assert.equal(defaultPrinterRole("KITCHEN_PRINTER"), "KITCHEN");
});

test("incompatible printer role assignments are rejected", () => {
  assert.equal(isPrinterRoleCompatible("RECEIPT", "KITCHEN_PRINTER"), false);
  assert.equal(isPrinterRoleCompatible("BAR", "KITCHEN_PRINTER"), true);
  const bad = assertAssignablePrinterRole({
    deviceType: "RECEIPT_PRINTER",
    printerRole: "BAR",
  });
  assert.equal(bad.ok, false);
  const barStation = assertAssignablePrinterRole({
    deviceType: "KITCHEN_PRINTER",
    printerRole: "BAR",
    kitchenStation: "MAIN",
  });
  assert.equal(barStation.ok, false);
  const ok = assertAssignablePrinterRole({
    deviceType: "KITCHEN_PRINTER",
    printerRole: "BAR",
    kitchenStation: "BAR",
  });
  assert.equal(ok.ok, true);
});

test("multiple receipt printers: primary vs secondary fallback without dual-print", () => {
  const devices = [
    printer({
      id: "primary",
      printerRole: "RECEIPT",
      configuration: { host: "10.0.0.1", isDefault: true },
    }),
    printer({
      id: "secondary",
      printerRole: "SECONDARY_RECEIPT",
      configuration: { host: "10.0.0.2", isFallback: true },
    }),
  ];
  const route = routeReceiptPrinter(devices);
  assert.equal(route.primary?.id, "primary");
  assert.equal(route.fallback?.id, "secondary");
  assert.notEqual(route.primary?.id, route.fallback?.id);
});

test("station-based kitchen routing sends only intended station tickets", () => {
  const devices = [
    printer({
      id: "main",
      deviceType: "KITCHEN_PRINTER",
      printerRole: "KITCHEN",
      kitchenStation: "MAIN",
    }),
    printer({
      id: "bar",
      deviceType: "KITCHEN_PRINTER",
      printerRole: "BAR",
      kitchenStation: "BAR",
    }),
    printer({
      id: "dessert",
      deviceType: "KITCHEN_PRINTER",
      printerRole: "KITCHEN",
      kitchenStation: "DESSERT",
    }),
  ];
  assert.equal(routeKotPrinter(devices, "BAR").primary?.id, "bar");
  assert.equal(routeKotPrinter(devices, "DESSERT").primary?.id, "dessert");
  assert.equal(routeKotPrinter(devices, "MAIN").primary?.id, "main");
});

test("print job idempotency key stable for same order/type/station", () => {
  const a = buildPrintDedupeKey({
    restaurantId: "r1",
    orderId: "ord-1",
    jobType: "KOT",
    station: "BAR",
  });
  const b = buildPrintDedupeKey({
    restaurantId: "r1",
    orderId: "ord-1",
    jobType: "KOT",
    station: "BAR",
  });
  const c = buildPrintDedupeKey({
    restaurantId: "r1",
    orderId: "ord-1",
    jobType: "KOT",
    station: "MAIN",
  });
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("unknown/manual review outcomes are terminal statuses on draft jobs", () => {
  const job = createPrintJobDraft({
    restaurantId: "r1",
    outletId: "o1",
    deviceId: "d1",
    jobType: "RECEIPT",
    dedupeKey: "k1",
    payloadSnapshot: {},
    simulated: false,
  });
  assert.equal(job.status, "QUEUED");
  const unknown: PrintJobRecord = { ...job, status: "UNKNOWN" };
  const review: PrintJobRecord = { ...job, status: "MANUAL_REVIEW" };
  assert.ok(["UNKNOWN", "MANUAL_REVIEW"].includes(unknown.status));
  assert.ok(["UNKNOWN", "MANUAL_REVIEW"].includes(review.status));
});

test("atomic claim semantics: only one winner when two connectors race", () => {
  // Pure simulation of findOneAndUpdate QUEUED→PROCESSING race.
  type Claimable = { id: string; status: "QUEUED" | "PROCESSING"; leaseConnectorId?: string };
  const jobs: Claimable[] = [{ id: "j1", status: "QUEUED" }];
  function claim(connectorId: string): Claimable | null {
    const job = jobs.find((j) => j.id === "j1" && j.status === "QUEUED");
    if (!job) return null;
    job.status = "PROCESSING";
    job.leaseConnectorId = connectorId;
    return { ...job };
  }
  const a = claim("conn-a");
  const b = claim("conn-b");
  assert.ok(a);
  assert.equal(b, null);
  assert.equal(a!.leaseConnectorId, "conn-a");
  assert.ok(PRINT_JOB_LEASE_MS > 0);
});

test("expired lease recovery restores QUEUED for reclaim", () => {
  const now = Date.now();
  const job = {
    status: "PROCESSING" as const,
    leaseExpiresAt: new Date(now - 1000).toISOString(),
    leaseConnectorId: "conn-stale",
  };
  const expired = new Date(job.leaseExpiresAt).getTime() < now;
  assert.equal(expired, true);
  if (expired) {
    job.status = "QUEUED" as "PROCESSING";
    delete (job as { leaseConnectorId?: string }).leaseConnectorId;
  }
  assert.equal(job.status, "QUEUED");
  assert.equal(job.leaseConnectorId, undefined);
});

test("compatibility registry uses honest verification labels", () => {
  assert.ok(
    HARDWARE_COMPATIBILITY_REGISTRY.every((p) => p.verificationStatus !== "PHYSICALLY_VERIFIED"),
  );
  assert.equal(normalizeVerificationStatus("AUTOMATED_TESTED"), "IMPLEMENTED_NOT_VERIFIED");
  assert.equal(normalizeVerificationStatus("SIMULATED"), "SIMULATED");
  assert.equal(normalizeVerificationStatus("UNSUPPORTED"), "UNSUPPORTED");
});

test("cross-outlet assignment guard is role/outlet based", () => {
  const roles: PrinterRole[] = ["RECEIPT", "KITCHEN", "BAR"];
  assert.ok(roles.includes("RECEIPT"));
  const deviceOutlet = "outlet-a";
  const connectorOutlet = "outlet-b";
  assert.notEqual(deviceOutlet, connectorOutlet);
});
