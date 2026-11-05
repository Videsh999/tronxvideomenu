import { CONNECTOR_OFFLINE_AFTER_MS } from "@/lib/devices/connector-crypto";
import { HARDWARE_COMPATIBILITY_REGISTRY } from "@/lib/devices/compatibility-registry";
import { connectorRepository } from "@/lib/repositories/connector.repository";
import { deviceRepository } from "@/lib/repositories/device.repository";

function redactDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactDeep);
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (
      lower.includes("secret") ||
      lower.includes("credential") ||
      lower.includes("password") ||
      lower.includes("token") ||
      lower.includes("authorization") ||
      lower === "code" ||
      lower.includes("phone") ||
      lower.includes("payment") ||
      lower.includes("card")
    ) {
      out[k] = "[redacted]";
      continue;
    }
    out[k] = redactDeep(v);
  }
  return out;
}

export class DeviceDiagnosticsService {
  async buildBundle(restaurantId: string) {
    const [devices, jobs, events, connectors] = await Promise.all([
      deviceRepository.listDevices(restaurantId),
      deviceRepository.listJobs(restaurantId, { limit: 200 }),
      deviceRepository.listEvents(restaurantId, { limit: 100 }),
      connectorRepository.listConnectors(restaurantId),
    ]);

    const now = Date.now();
    const jobCounts = {
      pending: jobs.filter((j) => j.status === "QUEUED" || j.status === "PROCESSING").length,
      failed: jobs.filter((j) => j.status === "FAILED").length,
      unknown: jobs.filter((j) => j.status === "UNKNOWN" || j.status === "MANUAL_REVIEW").length,
      completed: jobs.filter((j) => j.status === "COMPLETED").length,
    };

    const connectorSummaries = connectors.map((c) => {
      const stale =
        !c.lastHeartbeatAt ||
        now - new Date(c.lastHeartbeatAt).getTime() > CONNECTOR_OFFLINE_AFTER_MS;
      return {
        id: c.id,
        name: c.name,
        version: c.version,
        hostname: c.hostname,
        status: c.status === "REVOKED" ? "REVOKED" : stale ? "OFFLINE" : "ONLINE",
        lastHeartbeatAt: c.lastHeartbeatAt,
        // credentialHash intentionally omitted
      };
    });

    const deviceSummaries = devices.map((d) => ({
      id: d.id,
      name: d.name,
      deviceType: d.deviceType,
      simulated: d.simulated,
      adapterType: d.adapterType,
      connectionStatus: d.connectionStatus,
      healthStatus: d.healthStatus,
      kitchenStation: d.kitchenStation,
      lastSeenAt: d.lastSeenAt,
      configuration: redactDeep({
        host: d.configuration?.host,
        port: d.configuration?.port,
        paperWidth: d.configuration?.paperWidth,
        encoding: d.configuration?.encoding,
        isDefault: d.configuration?.isDefault,
        isFallback: d.configuration?.isFallback,
        capabilities: d.configuration?.capabilities,
        brandName: d.configuration?.brandName,
        // omit connector secrets if any were misplaced
      }),
    }));

    const recentJobs = jobs.slice(0, 50).map((j) => ({
      id: j.id,
      correlationId: j.correlationId,
      jobType: j.jobType,
      status: j.status,
      attemptCount: j.attemptCount,
      deviceId: j.deviceId,
      orderId: j.orderId,
      errorMessage: j.errorMessage,
      simulated: j.simulated,
      isReprint: j.isReprint,
      createdAt: j.createdAt,
      completedAt: j.completedAt,
      // payloadSnapshot omitted from export by default (may contain customer totals only — keep aggregate)
      payloadKeys: Object.keys(j.payloadSnapshot ?? {}),
    }));

    const bundle = {
      generatedAt: new Date().toISOString(),
      restaurantId,
      evidenceClass: "AUTOMATED_EXPORT",
      physicalVerification: "NONE",
      summary: {
        deviceCount: devices.length,
        connectorCount: connectors.length,
        jobCounts,
        onlineConnectors: connectorSummaries.filter((c) => c.status === "ONLINE").length,
      },
      connectors: connectorSummaries,
      devices: deviceSummaries,
      recentJobs,
      recentEvents: events.slice(0, 40).map((e) => ({
        id: e.id,
        type: e.type,
        deviceId: e.deviceId,
        simulated: e.simulated,
        createdAt: e.createdAt,
        payload: redactDeep(e.payload),
      })),
      compatibilityRegistry: HARDWARE_COMPATIBILITY_REGISTRY,
      notes: [
        "Secrets and pairing credentials are redacted.",
        "Customer phone/payment fields are redacted.",
        "No PHYSICALLY_VERIFIED claim is implied by this export.",
      ],
    };

    return redactDeep(bundle) as typeof bundle;
  }
}

export const deviceDiagnosticsService = new DeviceDiagnosticsService();
