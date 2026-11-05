#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { hostname } from "node:os";
import { loadConfig, saveConfig } from "./config/index.js";
import {
  ackJob,
  claimPairing,
  heartbeat,
  nextBackoffMs,
  pollJobs,
} from "./cloud/client.js";
import { executeCloudJob } from "./devices/executor.js";
import { deviceHealthReports } from "./health/index.js";
import { listReviewJobs } from "./jobs/local-store.js";
import { log } from "./logging/logger.js";
import { loadCredentials, saveCredentials } from "./security/credentials.js";

export const CONNECTOR_VERSION = "0.1.0";

async function pairCommand() {
  const config = loadConfig();
  const rl = createInterface({ input, output });
  try {
    const code = (await rl.question("Enter TRONX pairing code: ")).trim();
    if (!code) throw new Error("Pairing code required");
    const claimed = await claimPairing({
      cloudBaseUrl: config.cloudBaseUrl,
      code,
      hostname: hostname(),
      version: CONNECTOR_VERSION,
    });
    saveCredentials(config.dataDir, {
      connectorId: claimed.connectorId,
      connectorSecret: claimed.connectorSecret,
      restaurantId: claimed.restaurantId,
      outletId: claimed.outletId,
      credentialVersion: claimed.credentialVersion,
    });
    saveConfig({ ...config, connectorId: claimed.connectorId });
    log("info", "Paired successfully", {
      connectorId: claimed.connectorId,
      outletId: claimed.outletId,
    });
    console.log("Credentials stored. Configure printer host/port in the cloud Devices dashboard.");
  } finally {
    rl.close();
  }
}

async function runLoop() {
  const config = loadConfig();
  const creds = loadCredentials(config.dataDir);
  if (!creds) {
    console.error("Not paired. Run: npm run pair  (or tronx-device-connector pair)");
    process.exitCode = 1;
    return;
  }

  log("info", "TRONX Device Connector starting", {
    version: CONNECTOR_VERSION,
    connectorId: creds.connectorId,
    cloudBaseUrl: config.cloudBaseUrl,
  });

  let failStreak = 0;
  for (;;) {
    try {
      const { jobs, devices } = await pollJobs(config.cloudBaseUrl, creds);
      await heartbeat(config.cloudBaseUrl, creds, {
        version: CONNECTOR_VERSION,
        hostname: hostname(),
        devices: deviceHealthReports(devices),
      });
      failStreak = 0;

      for (const job of jobs) {
        const result = await executeCloudJob(config.dataDir, job, devices);
        await ackJob(config.cloudBaseUrl, creds, job.id, {
          status: result.status,
          errorMessage: result.errorMessage,
          payloadHash: result.payloadHash,
        });
      }

      const review = listReviewJobs(config.dataDir);
      if (review.length) {
        log("warn", "Jobs awaiting manual review", { count: review.length });
      }

      await sleep(2000);
    } catch (cause) {
      failStreak += 1;
      const wait = nextBackoffMs(failStreak);
      log("warn", "Cloud loop error; backing off", {
        waitMs: wait,
        error: cause instanceof Error ? cause.message : "unknown",
      });
      await sleep(wait);
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const cmd = process.argv[2] ?? "run";
if (cmd === "pair") {
  void pairCommand();
} else if (cmd === "version") {
  console.log(CONNECTOR_VERSION);
} else {
  void runLoop();
}
