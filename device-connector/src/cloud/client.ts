import { log } from "../logging/logger.js";
import type { StoredCredentials } from "../security/credentials.js";

export type CloudJob = {
  id: string;
  deviceId: string;
  jobType: string;
  payloadSnapshot: Record<string, unknown>;
  attemptCount: number;
  isReprint: boolean;
  status: string;
};

export type CloudDevice = {
  id: string;
  name: string;
  deviceType: string;
  configuration: Record<string, unknown>;
  kitchenStation?: string;
};

function authHeaders(creds: StoredCredentials): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-connector-id": creds.connectorId,
    "x-connector-secret": creds.connectorSecret,
  };
}

export async function claimPairing(params: {
  cloudBaseUrl: string;
  code: string;
  hostname?: string;
  version: string;
}): Promise<{
  connectorId: string;
  connectorSecret: string;
  restaurantId: string;
  outletId: string;
  credentialVersion: number;
}> {
  const res = await fetch(`${params.cloudBaseUrl.replace(/\/$/, "")}/api/connector/pair`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      code: params.code,
      hostname: params.hostname,
      version: params.version,
    }),
  });
  const json = (await res.json()) as { success: boolean; data?: Record<string, unknown>; error?: string };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? `Pairing failed (${res.status})`);
  }
  return {
    connectorId: String(json.data.connectorId),
    connectorSecret: String(json.data.connectorSecret),
    restaurantId: String(json.data.restaurantId),
    outletId: String(json.data.outletId),
    credentialVersion: Number(json.data.credentialVersion ?? 1),
  };
}

export async function heartbeat(
  cloudBaseUrl: string,
  creds: StoredCredentials,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(`${cloudBaseUrl.replace(/\/$/, "")}/api/connector/heartbeat`, {
    method: "POST",
    headers: authHeaders(creds),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? `Heartbeat failed (${res.status})`);
  }
}

export async function pollJobs(
  cloudBaseUrl: string,
  creds: StoredCredentials,
): Promise<{ jobs: CloudJob[]; devices: CloudDevice[] }> {
  const res = await fetch(`${cloudBaseUrl.replace(/\/$/, "")}/api/connector/jobs`, {
    method: "GET",
    headers: authHeaders(creds),
  });
  const json = (await res.json()) as {
    success: boolean;
    data?: { jobs: CloudJob[]; devices: CloudDevice[] };
    error?: string;
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error ?? `Poll failed (${res.status})`);
  }
  return json.data;
}

export async function ackJob(
  cloudBaseUrl: string,
  creds: StoredCredentials,
  jobId: string,
  body: { status: string; errorMessage?: string; payloadHash?: string },
): Promise<void> {
  const res = await fetch(
    `${cloudBaseUrl.replace(/\/$/, "")}/api/connector/jobs/${encodeURIComponent(jobId)}/ack`,
    {
      method: "POST",
      headers: authHeaders(creds),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    log("warn", "Job ack failed", { jobId, error: json.error ?? res.status });
  }
}

export function nextBackoffMs(attempt: number): number {
  const base = Math.min(60_000, 1000 * 2 ** Math.min(attempt, 6));
  const jitter = Math.floor(Math.random() * 400);
  return base + jitter;
}
