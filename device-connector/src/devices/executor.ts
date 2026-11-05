import { openCashDrawer } from "../cash-drawer/drawer.js";
import type { CloudDevice, CloudJob } from "../cloud/client.js";
import { upsertLocalJob } from "../jobs/local-store.js";
import { log } from "../logging/logger.js";
import {
  buildKotBytes,
  buildReceiptBytes,
  buildTestPageBytes,
  payloadHash,
  sendEscPos,
  type EscPosPrinterConfig,
  validatePrinterConfig,
} from "../printers/escpos.js";

export type ExecResult = {
  status: "COMPLETED" | "FAILED" | "UNKNOWN" | "MANUAL_REVIEW";
  errorMessage?: string;
  payloadHash?: string;
};

function printerConfig(device: CloudDevice | undefined): EscPosPrinterConfig {
  const cfg = device?.configuration ?? {};
  return {
    host: String(cfg.host ?? ""),
    port: Number(cfg.port ?? 9100),
    paperWidth: Number(cfg.paperWidth ?? 80),
    encoding: String(cfg.encoding ?? "ascii"),
    timeoutMs: 8_000,
    connectTimeoutMs: Number(cfg.connectTimeoutMs ?? 5_000),
    writeTimeoutMs: Number(cfg.writeTimeoutMs ?? 8_000),
    brandName: typeof cfg.brandName === "string" ? cfg.brandName : "TRONX",
    footerLines: Array.isArray(cfg.footerLines) ? cfg.footerLines.map(String) : undefined,
    capabilities:
      typeof cfg.capabilities === "object" && cfg.capabilities
        ? (cfg.capabilities as EscPosPrinterConfig["capabilities"])
        : undefined,
  };
}

export async function executeCloudJob(
  dataDir: string,
  job: CloudJob,
  devices: CloudDevice[],
): Promise<ExecResult> {
  const hash = payloadHash(job.payloadSnapshot);
  const existing = upsertLocalJob(dataDir, {
    id: job.id,
    deviceId: job.deviceId,
    jobType: job.jobType,
    payloadHash: hash,
    status: "PROCESSING",
    attemptCount: job.attemptCount,
    updatedAt: new Date().toISOString(),
  });
  if (existing.status === "COMPLETED") {
    return { status: "COMPLETED", payloadHash: existing.payloadHash };
  }

  const device = devices.find((d) => d.id === job.deviceId);
  const printer = printerConfig(device);
  const invalid = validatePrinterConfig(printer);
  if (invalid) {
    upsertLocalJob(dataDir, {
      ...existing,
      status: "FAILED",
      errorMessage: invalid,
      updatedAt: new Date().toISOString(),
    });
    return { status: "FAILED", errorMessage: invalid, payloadHash: hash };
  }

  let bytes: Buffer;
  if (job.jobType === "TEST_PAGE") bytes = buildTestPageBytes(printer);
  else if (job.jobType.startsWith("KOT") || job.jobType === "REPRINT_KOT") {
    bytes = buildKotBytes(job.payloadSnapshot, printer);
  } else if (job.payloadSnapshot.kind === "DRAWER_OPEN") {
    const drawer = await openCashDrawer(printer, {
      authorized: job.payloadSnapshot.authorized === true,
      reason: String(job.payloadSnapshot.reason ?? ""),
      userId: String(job.payloadSnapshot.userId ?? ""),
      shiftId: String(job.payloadSnapshot.shiftId ?? ""),
    });
    const status =
      drawer.status === "UNKNOWN" ? "UNKNOWN" : drawer.ok ? "COMPLETED" : "FAILED";
    upsertLocalJob(dataDir, {
      id: job.id,
      deviceId: job.deviceId,
      jobType: job.jobType,
      payloadHash: hash,
      status: status === "UNKNOWN" ? "MANUAL_REVIEW" : status,
      attemptCount: job.attemptCount,
      errorMessage: drawer.message,
      updatedAt: new Date().toISOString(),
    });
    return { status, errorMessage: drawer.message, payloadHash: hash };
  } else {
    bytes = buildReceiptBytes(job.payloadSnapshot, printer);
  }

  log("info", "Sending ESC/POS job", { jobId: job.id, host: printer.host, port: printer.port });
  const outcome = await sendEscPos(printer, bytes, job.payloadSnapshot);

  if (outcome.status === "COMPLETED") {
    upsertLocalJob(dataDir, {
      id: job.id,
      deviceId: job.deviceId,
      jobType: job.jobType,
      payloadHash: outcome.payloadHash,
      status: "COMPLETED",
      attemptCount: job.attemptCount,
      updatedAt: new Date().toISOString(),
    });
    return { status: "COMPLETED", payloadHash: outcome.payloadHash };
  }

  if (outcome.status === "UNKNOWN") {
    upsertLocalJob(dataDir, {
      id: job.id,
      deviceId: job.deviceId,
      jobType: job.jobType,
      payloadHash: outcome.payloadHash,
      status: "MANUAL_REVIEW",
      attemptCount: job.attemptCount,
      errorMessage: outcome.errorMessage,
      updatedAt: new Date().toISOString(),
    });
    // Financial receipts: do not auto-retry — report MANUAL_REVIEW / UNKNOWN to cloud.
    return {
      status: job.jobType.includes("RECEIPT") ? "MANUAL_REVIEW" : "UNKNOWN",
      errorMessage: outcome.errorMessage,
      payloadHash: outcome.payloadHash,
    };
  }

  upsertLocalJob(dataDir, {
    id: job.id,
    deviceId: job.deviceId,
    jobType: job.jobType,
    payloadHash: hash,
    status: "FAILED",
    attemptCount: job.attemptCount,
    errorMessage: outcome.errorMessage,
    updatedAt: new Date().toISOString(),
  });
  return { status: "FAILED", errorMessage: outcome.errorMessage, payloadHash: hash };
}
