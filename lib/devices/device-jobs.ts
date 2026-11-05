import { randomUUID } from "crypto";
import type { PrintJobRecord, PrintJobType } from "@/lib/devices/device.types";

export function buildPrintDedupeKey(params: {
  restaurantId: string;
  orderId: string;
  jobType: PrintJobType;
  station?: string;
  isReprint?: boolean;
  reprintNonce?: string;
}): string {
  if (params.isReprint) {
    return `reprint:${params.restaurantId}:${params.orderId}:${params.jobType}:${params.station ?? ""}:${params.reprintNonce ?? randomUUID()}`;
  }
  return `print:${params.restaurantId}:${params.orderId}:${params.jobType}:${params.station ?? "ALL"}`;
}

export function createPrintJobDraft(params: {
  restaurantId: string;
  outletId: string;
  deviceId: string;
  orderId?: string;
  jobType: PrintJobType;
  dedupeKey: string;
  payloadSnapshot: Record<string, unknown>;
  simulated: boolean;
  isReprint?: boolean;
  maxAttempts?: number;
  correlationId?: string;
}): PrintJobRecord {
  const now = new Date().toISOString();
  return {
    id: `pjob-${randomUUID()}`,
    restaurantId: params.restaurantId,
    outletId: params.outletId,
    deviceId: params.deviceId,
    orderId: params.orderId,
    jobType: params.jobType,
    dedupeKey: params.dedupeKey,
    payloadSnapshot: params.payloadSnapshot,
    status: "QUEUED",
    attemptCount: 0,
    maxAttempts: params.maxAttempts ?? 3,
    isReprint: Boolean(params.isReprint),
    simulated: params.simulated,
    correlationId: params.correlationId ?? `corr-${randomUUID()}`,
    createdAt: now,
    updatedAt: now,
  };
}

export function isRecoverablePrintError(errorCode?: string): boolean {
  return errorCode === "OFFLINE" || errorCode === "PAPER_OUT" || errorCode === "TIMEOUT" || errorCode === "PRINT_FAIL";
}
