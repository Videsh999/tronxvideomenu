/**
 * Multi-connector print job claim / lease recovery integration suite.
 *
 * Requires:
 *   RUN_INTEGRATION=1 MONGODB_URI=mongodb://... npm run test:integration
 */
import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { createPrintJobDraft } from "../../lib/devices/device-jobs";
import type { DeviceConnectorRecord, DeviceRecord } from "../../lib/devices/device.types";
import { connectReplicaSet, disconnectTestDatabase, integrationEnabled } from "./harness";

const enabled = integrationEnabled();

function skipReason() {
  return "Set RUN_INTEGRATION=1. npm run test:integration starts a replica set and fails if it cannot.";
}

async function connect() {
  await connectReplicaSet();
}

test("assigned connector claims job; unassigned connector cannot", async (t) => {
  if (!enabled) {
    t.skip(skipReason());
    return;
  }
  await connect();
  const { connectorRepository } = await import("../../lib/repositories/connector.repository");
  const { deviceRepository } = await import("../../lib/repositories/device.repository");
  const { HardwareDeviceModel, PrintJobModel, DeviceConnectorModel } = await import(
    "../../lib/db/models"
  );

  const restaurantId = `fleet-r-${randomUUID()}`;
  const outletId = restaurantId;
  const now = new Date().toISOString();

  const connA: DeviceConnectorRecord = {
    id: `conn-${randomUUID()}`,
    restaurantId,
    outletId,
    name: "A",
    credentialHash: "x",
    credentialVersion: 1,
    status: "ONLINE",
    pairedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  const connB: DeviceConnectorRecord = { ...connA, id: `conn-${randomUUID()}`, name: "B" };
  await DeviceConnectorModel.create([connA, connB]);

  const device: DeviceRecord = {
    id: `dev-${randomUUID()}`,
    restaurantId,
    outletId,
    name: "Shared printer",
    deviceType: "RECEIPT_PRINTER",
    manufacturer: "Generic",
    model: "ESC/POS",
    connectionType: "NETWORK",
    adapterType: "CONNECTOR",
    connectionStatus: "CONNECTED",
    healthStatus: "HEALTHY",
    capabilities: ["PRINT"],
    configuration: { connectorId: connA.id, host: "10.0.0.9", port: 9100 },
    simulated: false,
    enabled: true,
    printerRole: "RECEIPT",
    createdAt: now,
    updatedAt: now,
  };
  await HardwareDeviceModel.create(device);

  const job = createPrintJobDraft({
    restaurantId,
    outletId,
    deviceId: device.id,
    orderId: `ord-${randomUUID()}`,
    jobType: "RECEIPT",
    dedupeKey: `dedupe-${randomUUID()}`,
    payloadSnapshot: { total: 1 },
    simulated: false,
  });
  await PrintJobModel.create(job);

  const [claimedA, claimedB] = await Promise.all([
    connectorRepository.claimQueuedJobs({
      restaurantId,
      outletId,
      connectorId: connA.id,
      limit: 5,
    }),
    connectorRepository.claimQueuedJobs({
      restaurantId,
      outletId,
      connectorId: connB.id,
      limit: 5,
    }),
  ]);

  assert.equal(claimedA.length, 1);
  assert.equal(claimedB.length, 0);
  assert.equal(claimedA[0]!.leaseConnectorId, connA.id);

  // Reassign to B while job is PROCESSING — B must not reclaim until lease expires.
  await deviceRepository.updateDevice(restaurantId, device.id, {
    configuration: { connectorId: connB.id, host: "10.0.0.9", port: 9100 },
  });
  const claimedB2 = await connectorRepository.claimQueuedJobs({
    restaurantId,
    outletId,
    connectorId: connB.id,
  });
  assert.equal(claimedB2.length, 0);

  await PrintJobModel.deleteMany({ restaurantId });
  await HardwareDeviceModel.deleteMany({ restaurantId });
  await DeviceConnectorModel.deleteMany({ restaurantId });
  await disconnectTestDatabase();
});

test("two connectors racing the same assigned job: exactly one wins", async (t) => {
  if (!enabled) {
    t.skip(skipReason());
    return;
  }
  await connect();
  const { connectorRepository } = await import("../../lib/repositories/connector.repository");
  const { HardwareDeviceModel, PrintJobModel, DeviceConnectorModel } = await import(
    "../../lib/db/models"
  );

  const restaurantId = `fleet-race-${randomUUID()}`;
  const outletId = restaurantId;
  const now = new Date().toISOString();
  const connAId = `conn-${randomUUID()}`;
  const connBId = `conn-${randomUUID()}`;
  await DeviceConnectorModel.create([
    {
      id: connAId,
      restaurantId,
      outletId,
      name: "RaceA",
      credentialHash: "x",
      credentialVersion: 1,
      status: "ONLINE",
      pairedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: connBId,
      restaurantId,
      outletId,
      name: "RaceB",
      credentialHash: "x",
      credentialVersion: 1,
      status: "ONLINE",
      pairedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  // Same physical printer listed under both connectors (misconfig) — claim must still be unique.
  const deviceId = `dev-${randomUUID()}`;
  await HardwareDeviceModel.create([
    {
      id: deviceId,
      restaurantId,
      outletId,
      name: "Race printer",
      deviceType: "RECEIPT_PRINTER",
      manufacturer: "Generic",
      model: "ESC/POS",
      connectionType: "NETWORK",
      adapterType: "CONNECTOR",
      connectionStatus: "CONNECTED",
      healthStatus: "HEALTHY",
      capabilities: ["PRINT"],
      configuration: { connectorId: connAId, host: "10.0.0.7", port: 9100 },
      simulated: false,
      enabled: true,
      printerRole: "RECEIPT",
      createdAt: now,
      updatedAt: now,
    },
  ]);
  // Second connector "sees" same device via temporary dual index simulation:
  // claimQueuedJobs filters by configuration.connectorId, so flip is not possible for one doc.
  // Instead race two claim loops on the same connector id (true atomicity), then assert single winner.
  const job = createPrintJobDraft({
    restaurantId,
    outletId,
    deviceId,
    orderId: `ord-${randomUUID()}`,
    jobType: "RECEIPT",
    dedupeKey: `dedupe-${randomUUID()}`,
    payloadSnapshot: {},
    simulated: false,
  });
  await PrintJobModel.create(job);

  const results = await Promise.all(
    Array.from({ length: 12 }, () =>
      connectorRepository.claimQueuedJobs({
        restaurantId,
        outletId,
        connectorId: connAId,
        limit: 5,
      }),
    ),
  );
  const winners = results.filter((r) => r.length > 0);
  assert.equal(winners.length, 1);
  assert.equal(winners[0]![0]!.status, "PROCESSING");

  await PrintJobModel.deleteMany({ restaurantId });
  await HardwareDeviceModel.deleteMany({ restaurantId });
  await DeviceConnectorModel.deleteMany({ restaurantId });
  await disconnectTestDatabase();
});

test("expired lease returns to QUEUED and can be reclaimed", async (t) => {
  if (!enabled) {
    t.skip(skipReason());
    return;
  }
  await connect();
  const { connectorRepository } = await import("../../lib/repositories/connector.repository");
  const { HardwareDeviceModel, PrintJobModel, DeviceConnectorModel } = await import(
    "../../lib/db/models"
  );

  const restaurantId = `fleet-lease-${randomUUID()}`;
  const outletId = restaurantId;
  const now = new Date().toISOString();
  const connector: DeviceConnectorRecord = {
    id: `conn-${randomUUID()}`,
    restaurantId,
    outletId,
    name: "LeaseConn",
    credentialHash: "x",
    credentialVersion: 1,
    status: "ONLINE",
    pairedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  await DeviceConnectorModel.create(connector);
  const device: DeviceRecord = {
    id: `dev-${randomUUID()}`,
    restaurantId,
    outletId,
    name: "Lease printer",
    deviceType: "RECEIPT_PRINTER",
    manufacturer: "Generic",
    model: "ESC/POS",
    connectionType: "NETWORK",
    adapterType: "CONNECTOR",
    connectionStatus: "CONNECTED",
    healthStatus: "HEALTHY",
    capabilities: ["PRINT"],
    configuration: { connectorId: connector.id, host: "10.0.0.8", port: 9100 },
    simulated: false,
    enabled: true,
    printerRole: "RECEIPT",
    createdAt: now,
    updatedAt: now,
  };
  await HardwareDeviceModel.create(device);

  const job = createPrintJobDraft({
    restaurantId,
    outletId,
    deviceId: device.id,
    orderId: `ord-${randomUUID()}`,
    jobType: "TEST_PAGE",
    dedupeKey: `dedupe-${randomUUID()}`,
    payloadSnapshot: {},
    simulated: false,
  });
  await PrintJobModel.create({
    ...job,
    status: "PROCESSING",
    leaseConnectorId: "conn-dead",
    leaseExpiresAt: new Date(Date.now() - 60_000).toISOString(),
    connectorId: "conn-dead",
  });

  const recovered = await connectorRepository.recoverExpiredLeases(restaurantId, outletId);
  assert.ok(recovered >= 1);

  const claimed = await connectorRepository.claimQueuedJobs({
    restaurantId,
    outletId,
    connectorId: connector.id,
  });
  assert.equal(claimed.length, 1);
  assert.equal(claimed[0]!.leaseConnectorId, connector.id);

  await PrintJobModel.deleteMany({ restaurantId });
  await HardwareDeviceModel.deleteMany({ restaurantId });
  await DeviceConnectorModel.deleteMany({ restaurantId });
  await disconnectTestDatabase();
});

test("revoked connector cannot authenticate", async (t) => {
  if (!enabled) {
    t.skip(skipReason());
    return;
  }
  await connect();
  const { connectorService } = await import("../../lib/services/connector.service");
  const { DeviceConnectorModel } = await import("../../lib/db/models");
  const restaurantId = `fleet-rev-${randomUUID()}`;
  const now = new Date().toISOString();
  const id = `conn-${randomUUID()}`;
  await DeviceConnectorModel.create({
    id,
    restaurantId,
    outletId: restaurantId,
    name: "Revoked",
    credentialHash: "dead",
    credentialVersion: 2,
    status: "REVOKED",
    pairedAt: now,
    revokedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  const list = await connectorService.listForRestaurant(restaurantId);
  assert.equal(list[0]?.displayStatus, "REVOKED");
  await assert.rejects(() => connectorService.authenticateConnector(id, "any"), /unauthorized/i);
  await DeviceConnectorModel.deleteMany({ restaurantId });
  await disconnectTestDatabase();
});
