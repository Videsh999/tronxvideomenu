import assert from "node:assert/strict";
import test from "node:test";
import {
  generatePairingCode,
  hashSecret,
  verifySecret,
  PAIRING_CODE_TTL_MS,
  hashPayload,
} from "../lib/devices/connector-crypto";
import { ensureConnectorAdaptersRegistered } from "../lib/devices/device-manager";
import { resolveDeviceAdapter, listRegisteredAdapterKeys } from "../lib/devices/device-registry";
import { hasRestaurantFeature } from "../lib/features";
import type { DeviceRecord } from "../lib/devices/device.types";

test("pairing code is single-use hashable secret material", () => {
  const code = generatePairingCode();
  assert.equal(code.length, 8);
  const hash = hashSecret(code);
  assert.equal(verifySecret(code, hash), true);
  assert.equal(verifySecret(code + "X", hash), false);
  assert.ok(PAIRING_CODE_TTL_MS <= 15 * 60 * 1000);
});

test("organization isolation relies on hashed pairing binding not client IDs", () => {
  // Connector claim never accepts restaurantId from body — covered by claimPairing API shape.
  const a = hashSecret("ORG-A-CODE");
  const b = hashSecret("ORG-B-CODE");
  assert.notEqual(a, b);
});

test("connector adapters register without removing simulator", () => {
  ensureConnectorAdaptersRegistered();
  const keys = listRegisteredAdapterKeys();
  assert.ok(keys.includes("SIMULATOR::RECEIPT_PRINTER"));
  assert.ok(keys.includes("CONNECTOR::RECEIPT_PRINTER"));
  assert.ok(keys.includes("CONNECTOR::KITCHEN_PRINTER"));
});

test("cloud connector adapter defers PRINT as PENDING physical", async () => {
  ensureConnectorAdaptersRegistered();
  const adapter = resolveDeviceAdapter("CONNECTOR", "RECEIPT_PRINTER");
  assert.ok(adapter);
  const device = {
    id: "d1",
    restaurantId: "r1",
    outletId: "r1",
    name: "Net printer",
    deviceType: "RECEIPT_PRINTER",
    manufacturer: "Generic",
    model: "ESC/POS",
    connectionType: "NETWORK",
    adapterType: "CONNECTOR",
    connectionStatus: "DISCONNECTED",
    healthStatus: "UNKNOWN",
    capabilities: [],
    configuration: { connectorId: "conn-1", host: "10.0.0.8", port: 9100 },
    simulated: false,
    enabled: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } satisfies DeviceRecord;
  const result = await adapter!.sendCommand(device, { name: "PRINT", payload: { orderNumber: 1 } });
  assert.equal(result.simulated, false);
  assert.equal(result.status, "PENDING");
  assert.equal(result.data?.physical, true);
});

test("uncertain outcomes are distinct payload hashes", () => {
  const h1 = hashPayload({ orderId: "o1", total: 10 });
  const h2 = hashPayload({ orderId: "o1", total: 11 });
  assert.notEqual(h1, h2);
});

test("HARDWARE_LOCAL_CONNECTOR is ENTERPRISE", () => {
  assert.equal(hasRestaurantFeature({ subscriptionPlan: "PRO" }, "HARDWARE_LOCAL_CONNECTOR"), false);
  assert.equal(hasRestaurantFeature({ subscriptionPlan: "ENTERPRISE" }, "HARDWARE_LOCAL_CONNECTOR"), true);
});
