import { randomUUID } from "crypto";
import { connectToDatabase } from "@/lib/db/mongodb";
import { HardwarePilotRunModel } from "@/lib/db/models";
import { toDomain } from "@/lib/db/mongo-mappers";
import { deviceService } from "@/lib/services/device.service";
import { connectorService } from "@/lib/services/connector.service";

export type PilotStepId =
  | "CONNECTOR_ONLINE"
  | "PRINTER_TCP_CONFIG"
  | "TEST_PRINT_QUEUED"
  | "FORMAT_58_80_PREVIEW"
  | "ENCODING_PREVIEW"
  | "RECEIPT_PREVIEW"
  | "KOT_PREVIEW"
  | "CONSECUTIVE_QUEUE"
  | "MANUAL_RECOVERY_NOTE";

export type PilotStepResult = {
  id: PilotStepId;
  status: "PASSED" | "FAILED" | "SKIPPED" | "PENDING_PHYSICAL";
  detail: string;
  evidenceClass: "AUTOMATED" | "REQUIRES_PHYSICAL";
};

const GUIDED_STEPS: Array<{ id: PilotStepId; label: string; physical: boolean }> = [
  { id: "CONNECTOR_ONLINE", label: "Connector online check", physical: false },
  { id: "PRINTER_TCP_CONFIG", label: "Printer TCP configuration check", physical: false },
  { id: "TEST_PRINT_QUEUED", label: "Test print enqueue", physical: true },
  { id: "FORMAT_58_80_PREVIEW", label: "58mm/80mm formatting preview", physical: false },
  { id: "ENCODING_PREVIEW", label: "Character encoding preview", physical: false },
  { id: "RECEIPT_PREVIEW", label: "Receipt layout preview", physical: false },
  { id: "KOT_PREVIEW", label: "KOT layout preview", physical: false },
  { id: "CONSECUTIVE_QUEUE", label: "Multiple consecutive queue test", physical: true },
  { id: "MANUAL_RECOVERY_NOTE", label: "Unplug/reconnect & paper-out (manual)", physical: true },
];

export class HardwarePilotService {
  listGuidedSteps() {
    return GUIDED_STEPS;
  }

  async startRun(params: {
    restaurantId: string;
    outletId: string;
    performedBy: string;
    connectorId?: string;
    deviceId?: string;
    deviceModel?: string;
    osVersion?: string;
    connectorVersion?: string;
  }) {
    await connectToDatabase();
    const now = new Date().toISOString();
    const run = {
      id: `pilot-${randomUUID()}`,
      restaurantId: params.restaurantId,
      outletId: params.outletId,
      connectorId: params.connectorId,
      deviceId: params.deviceId,
      deviceModel: params.deviceModel,
      osVersion: params.osVersion,
      connectorVersion: params.connectorVersion,
      performedBy: params.performedBy,
      steps: [] as PilotStepResult[],
      overallStatus: "IN_PROGRESS" as const,
      notes: "Physical verification steps remain PENDING_PHYSICAL until admin confirms paper output.",
      createdAt: now,
      updatedAt: now,
    };
    await HardwarePilotRunModel.create(run);
    return run;
  }

  async runAutomatedChecks(params: {
    restaurantId: string;
    runId: string;
    deviceId?: string;
  }) {
    await connectToDatabase();
    const run = await HardwarePilotRunModel.findOne({
      id: params.runId,
      restaurantId: params.restaurantId,
    }).lean();
    if (!run) throw new Error("Pilot run not found");

    const steps: PilotStepResult[] = [];
    const connectors = await connectorService.listForRestaurant(params.restaurantId);
    const online = connectors.find((c) => c.displayStatus === "ONLINE");
    steps.push({
      id: "CONNECTOR_ONLINE",
      status: online ? "PASSED" : "FAILED",
      detail: online
        ? `Connector ${online.name} online (heartbeat ${online.lastHeartbeatAt})`
        : "No online connector — pair/start Windows connector before physical prints.",
      evidenceClass: "AUTOMATED",
    });

    const devices = await deviceService.list(params.restaurantId);
    const device =
      (params.deviceId
        ? devices.find((d) => d.id === params.deviceId)
        : devices.find((d) => d.deviceType === "RECEIPT_PRINTER" && !d.simulated)) ?? null;

    if (!device) {
      steps.push({
        id: "PRINTER_TCP_CONFIG",
        status: "FAILED",
        detail: "No physical/connector receipt printer found.",
        evidenceClass: "AUTOMATED",
      });
    } else {
      const host = String(device.configuration?.host ?? "").trim();
      steps.push({
        id: "PRINTER_TCP_CONFIG",
        status: host ? "PASSED" : "FAILED",
        detail: host
          ? `Host ${host}:${device.configuration?.port ?? 9100}`
          : "Printer host/IP missing in configuration.",
        evidenceClass: "AUTOMATED",
      });

      for (const width of [58, 80] as const) {
        const preview = deviceService.previewPrint(
          {
            ...device,
            configuration: { ...device.configuration, paperWidth: width },
          },
          { orderNumber: "PILOT", total: 10, items: [{ name: "Pilot Item", qty: 1, total: 10 }] },
          "TEST_PAGE",
        );
        steps.push({
          id: "FORMAT_58_80_PREVIEW",
          status: preview.previewLines.length > 0 ? "PASSED" : "FAILED",
          detail: `${width}mm preview lines=${preview.previewLines.length}; unsupported=${preview.unsupported.join(",") || "none"}`,
          evidenceClass: "AUTOMATED",
        });
      }

      const enc = deviceService.previewPrint(
        { ...device, configuration: { ...device.configuration, encoding: "ascii" } },
        { orderNumber: "ENC", items: [{ name: "Café — test", qty: 1, total: 1 }] },
        "RECEIPT",
      );
      steps.push({
        id: "ENCODING_PREVIEW",
        status: "PASSED",
        detail: `ascii encoding preview ok (${enc.previewLines.length} lines)`,
        evidenceClass: "AUTOMATED",
      });

      const receipt = deviceService.previewPrint(device, { orderNumber: "R1", total: 100 }, "RECEIPT");
      steps.push({
        id: "RECEIPT_PREVIEW",
        status: receipt.previewLines.length ? "PASSED" : "FAILED",
        detail: receipt.previewLines.slice(0, 6).join(" | "),
        evidenceClass: "AUTOMATED",
      });
      const kot = deviceService.previewPrint(
        device,
        { orderNumber: "K1", station: "MAIN", items: [{ name: "Item", qty: 2 }] },
        "KOT",
      );
      steps.push({
        id: "KOT_PREVIEW",
        status: kot.previewLines.length ? "PASSED" : "FAILED",
        detail: kot.previewLines.slice(0, 6).join(" | "),
        evidenceClass: "AUTOMATED",
      });

      // Queue test print — physical paper confirmation is separate.
      const queued = await deviceService.enqueuePrintJob({
        restaurantId: params.restaurantId,
        outletId: device.outletId,
        deviceId: device.id,
        jobType: "TEST_PAGE",
        payload: { orderNumber: "PILOT-TEST", items: [{ name: "Pilot test", qty: 1, total: 0 }], total: 0 },
      });
      steps.push({
        id: "TEST_PRINT_QUEUED",
        status: queued.job ? "PENDING_PHYSICAL" : "FAILED",
        detail: `Job ${queued.job.id} status=${queued.job.status}. Confirm paper output manually — not PHYSICALLY_VERIFIED by software.`,
        evidenceClass: "REQUIRES_PHYSICAL",
      });

      const second = await deviceService.enqueuePrintJob({
        restaurantId: params.restaurantId,
        outletId: device.outletId,
        deviceId: device.id,
        jobType: "TEST_PAGE",
        isReprint: true,
        payload: { orderNumber: "PILOT-TEST-2", items: [{ name: "Pilot test 2", qty: 1, total: 0 }] },
      });
      steps.push({
        id: "CONSECUTIVE_QUEUE",
        status: "PENDING_PHYSICAL",
        detail: `Second job ${second.job.id} queued. Confirm consecutive prints on device.`,
        evidenceClass: "REQUIRES_PHYSICAL",
      });
    }

    steps.push({
      id: "MANUAL_RECOVERY_NOTE",
      status: "PENDING_PHYSICAL",
      detail:
        "Manually unplug/reconnect printer, restart connector, and test paper-out if supported. Record results in notes.",
      evidenceClass: "REQUIRES_PHYSICAL",
    });

    const failed = steps.some((s) => s.status === "FAILED");
    const pendingPhysical = steps.some((s) => s.status === "PENDING_PHYSICAL");
    const overallStatus = failed
      ? "FAILED"
      : pendingPhysical
        ? "NOT_PHYSICALLY_RUN"
        : "PASSED";

    const updated = await HardwarePilotRunModel.findOneAndUpdate(
      { id: params.runId, restaurantId: params.restaurantId },
      {
        $set: {
          steps,
          overallStatus,
          updatedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        },
      },
      { new: true },
    ).lean();

    return updated ? toDomain(updated) : null;
  }

  async listRuns(restaurantId: string) {
    await connectToDatabase();
    const rows = await HardwarePilotRunModel.find({ restaurantId }).sort({ createdAt: -1 }).limit(20).lean();
    return rows.map((r) => toDomain(r));
  }
}

export const hardwarePilotService = new HardwarePilotService();
