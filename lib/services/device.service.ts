import { randomUUID } from "crypto";
import { makeDeviceEvent } from "@/lib/devices/device-events";
import { deriveHealthFromResult } from "@/lib/devices/device-health";
import {
  buildPrintDedupeKey,
  createPrintJobDraft,
  isRecoverablePrintError,
} from "@/lib/devices/device-jobs";
import {
  connectDevice,
  DeviceManagerError,
  disconnectDevice,
  healthCheckDevice,
  runDeviceCommand,
} from "@/lib/devices/device-manager";
import { buildSampleSimulatorDevices } from "@/lib/devices/sample-devices";
import { resolveProfile, validatePrinterConfiguration } from "@/lib/devices/escpos/capabilities";
import { buildEscPosDocument } from "@/lib/devices/escpos/layout";
import { assertAssignablePrinterRole } from "@/lib/devices/printer-roles";
import {
  jobTypeForRoute,
  routeKotPrinter,
  routeReceiptPrinter,
} from "@/lib/devices/printer-routing";
import type {
  DeviceCommand,
  DeviceCommandName,
  DeviceRecord,
  DeviceType,
  PrinterRole,
  PrintJobRecord,
  PrintJobType,
} from "@/lib/devices/device.types";
import { getSimulatorRuntime } from "@/lib/devices/adapters/simulator/simulator-state";
import { deviceRepository } from "@/lib/repositories/device.repository";
import type { RestaurantOrder } from "@/types";

export class DeviceServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode = 400,
    readonly code?: string,
  ) {
    super(message);
  }
}

function assertTenant(device: DeviceRecord | null, restaurantId: string): DeviceRecord {
  if (!device || device.restaurantId !== restaurantId) {
    throw new DeviceServiceError("Device not found.", 404, "NOT_FOUND");
  }
  return device;
}

export class DeviceService {
  list(restaurantId: string, outletId?: string) {
    return deviceRepository.listDevices(restaurantId, outletId);
  }

  async get(restaurantId: string, deviceId: string) {
    return assertTenant(await deviceRepository.findDevice(restaurantId, deviceId), restaurantId);
  }

  async registerSampleDevices(params: {
    restaurantId: string;
    outletId: string;
    organizationId?: string;
  }) {
    const existing = await deviceRepository.listDevices(params.restaurantId, params.outletId);
    const simExisting = existing.filter((d) => d.simulated);
    if (simExisting.length >= 6) {
      return { created: [], existing: simExisting, message: "Sample simulator devices already present." };
    }
    const samples = buildSampleSimulatorDevices(params);
    const created = await deviceRepository.insertDevices(samples);
    return { created, existing: simExisting, message: `Registered ${created.length} simulated devices.` };
  }

  async updateDevice(
    restaurantId: string,
    deviceId: string,
    patch: Partial<
      Pick<
        DeviceRecord,
        "name" | "enabled" | "configuration" | "kitchenStation" | "outletId" | "printerRole"
      >
    >,
    actorId?: string,
  ) {
    const current = await this.get(restaurantId, deviceId);
    const nextRole = (patch.printerRole ?? current.printerRole) as PrinterRole | undefined;
    const nextStation =
      patch.kitchenStation !== undefined ? patch.kitchenStation : current.kitchenStation;
    if (patch.printerRole !== undefined || patch.kitchenStation !== undefined) {
      const check = assertAssignablePrinterRole({
        deviceType: current.deviceType,
        printerRole: nextRole,
        kitchenStation: nextStation,
      });
      if (!check.ok) throw new DeviceServiceError(check.error, 400, "INVALID_ROLE");
    }
    if (patch.configuration) {
      const merged = { ...current.configuration, ...patch.configuration };
      if (
        current.deviceType === "RECEIPT_PRINTER" ||
        current.deviceType === "KITCHEN_PRINTER"
      ) {
        const errors = validatePrinterConfiguration(merged);
        // Allow saving simulators without host; require host for physical/connector.
        if (!current.simulated && current.adapterType === "CONNECTOR" && errors.length) {
          throw new DeviceServiceError(errors.join(" "), 400, "INVALID_CONFIG");
        }
      }
      patch = { ...patch, configuration: merged };
    }
    const connectionStatus = patch.enabled === false ? "DISABLED" : undefined;
    const clearStation =
      nextRole === "RECEIPT" || nextRole === "SECONDARY_RECEIPT"
        ? { kitchenStation: undefined as unknown as string }
        : {};
    const updated = await deviceRepository.updateDevice(restaurantId, deviceId, {
      ...patch,
      ...clearStation,
      ...(connectionStatus ? { connectionStatus } : {}),
    });
    await deviceRepository.insertEvent(
      makeDeviceEvent(
        current,
        "DEVICE_CONFIG_UPDATED",
        {
          patch: {
            name: patch.name,
            enabled: patch.enabled,
            kitchenStation: patch.kitchenStation,
            printerRole: patch.printerRole,
            configurationKeys: patch.configuration ? Object.keys(patch.configuration) : undefined,
          },
        },
        actorId,
      ),
    );
    return updated;
  }

  /** Preview ESC/POS text for a device without sending bytes. */
  previewPrint(
    device: DeviceRecord,
    payload: Record<string, unknown>,
    kind: "RECEIPT" | "KOT" | "TEST_PAGE" = "TEST_PAGE",
  ) {
    const profile = resolveProfile(device.configuration ?? {});
    return buildEscPosDocument(
      {
        kind,
        orderNumber: payload.orderNumber as string | number | undefined,
        station: payload.station as string | undefined,
        isReprint: Boolean(payload.isReprint),
        items: Array.isArray(payload.items)
          ? (payload.items as Array<{ name?: string; qty?: number; total?: number; notes?: string }>)
          : [{ name: "Test item", qty: 1, total: 0 }],
        subtotal: Number(payload.subtotal ?? 0),
        discount: Number(payload.discount ?? 0),
        tax: Number(payload.tax ?? 0),
        total: Number(payload.total ?? 0),
        paymentStatus: payload.paymentStatus as string | undefined,
        qrPayload: payload.qrPayload as string | undefined,
      },
      profile,
    );
  }

  async removeDevice(restaurantId: string, deviceId: string) {
    await this.get(restaurantId, deviceId);
    await deviceRepository.deleteDevice(restaurantId, deviceId);
    return { removed: true };
  }

  async reconnect(restaurantId: string, deviceId: string, actorId?: string) {
    const device = await this.get(restaurantId, deviceId);
    if (!device.enabled) throw new DeviceServiceError("Device is disabled.", 403, "DISABLED");
    const result = await connectDevice(device);
    const updated = await deviceRepository.updateDevice(restaurantId, deviceId, {
      connectionStatus: "CONNECTED",
      healthStatus: "HEALTHY",
      lastSeenAt: new Date().toISOString(),
    });
    await deviceRepository.insertEvent(
      makeDeviceEvent(device, "RECONNECT", { result }, actorId),
    );
    return { device: updated, result };
  }

  async command(
    restaurantId: string,
    deviceId: string,
    command: DeviceCommand,
    actorId?: string,
  ) {
    const device = await this.get(restaurantId, deviceId);
    try {
      const result = await runDeviceCommand(device, command);
      const healthStatus = deriveHealthFromResult(device, result);
      const rt = device.simulated ? getSimulatorRuntime(device.id) : null;
      await deviceRepository.updateDevice(restaurantId, deviceId, {
        healthStatus,
        connectionStatus: rt?.offline ? "DISCONNECTED" : device.enabled ? "CONNECTED" : "DISABLED",
        lastSeenAt: new Date().toISOString(),
      });
      await deviceRepository.insertEvent(
        makeDeviceEvent(device, `COMMAND_${command.name}`, { command, result }, actorId),
      );
      return { result, deviceId };
    } catch (cause) {
      if (cause instanceof DeviceManagerError) {
        throw new DeviceServiceError(cause.message, cause.statusCode, cause.code);
      }
      throw cause;
    }
  }

  async health(restaurantId: string, deviceId: string, actorId?: string) {
    const device = await this.get(restaurantId, deviceId);
    const result = await healthCheckDevice(device);
    const healthStatus = deriveHealthFromResult(device, result);
    const updated = await deviceRepository.updateDevice(restaurantId, deviceId, {
      healthStatus,
      lastSeenAt: new Date().toISOString(),
    });
    await deviceRepository.insertEvent(
      makeDeviceEvent(device, "HEALTH_CHECK", { result }, actorId),
    );
    return { device: updated, result };
  }

  listEvents(restaurantId: string, deviceId?: string) {
    return deviceRepository.listEvents(restaurantId, { deviceId, limit: 100 });
  }

  listJobs(restaurantId: string) {
    return deviceRepository.listJobs(restaurantId, { limit: 100 });
  }

  /**
   * Enqueue + process a print job. Duplicate dedupeKey returns existing job (no second print).
   * Failures are recorded; never throws for print failure — caller gets warning payload.
   */
  async enqueuePrintJob(params: {
    restaurantId: string;
    outletId: string;
    deviceId: string;
    orderId?: string;
    jobType: PrintJobType;
    payload: Record<string, unknown>;
    isReprint?: boolean;
    actorId?: string;
  }): Promise<{ job: PrintJobRecord; warning?: string; duplicate: boolean }> {
    const device = await this.get(params.restaurantId, params.deviceId);
    if (device.deviceType !== "RECEIPT_PRINTER" && device.deviceType !== "KITCHEN_PRINTER") {
      throw new DeviceServiceError("Device is not a printer.", 400, "WRONG_TYPE");
    }
    const dedupeKey = buildPrintDedupeKey({
      restaurantId: params.restaurantId,
      orderId: params.orderId ?? `manual-${randomUUID()}`,
      jobType: params.jobType,
      station: device.kitchenStation,
      isReprint: params.isReprint,
    });
    const existing = await deviceRepository.findJobByDedupe(params.restaurantId, dedupeKey);
    if (existing && ["QUEUED", "PROCESSING", "COMPLETED"].includes(existing.status)) {
      return { job: existing, duplicate: true, warning: "Duplicate print suppressed." };
    }

    const job = createPrintJobDraft({
      restaurantId: params.restaurantId,
      outletId: params.outletId,
      deviceId: params.deviceId,
      orderId: params.orderId,
      jobType: params.jobType,
      dedupeKey,
      payloadSnapshot: params.payload,
      simulated: device.simulated,
      isReprint: params.isReprint,
    });
    await deviceRepository.insertJob(job);

    // Physical connector devices: leave QUEUED for authenticated connector poll.
    if (device.adapterType === "CONNECTOR") {
      await deviceRepository.insertEvent(
        makeDeviceEvent(
          device,
          "PRINT_JOB_QUEUED_FOR_CONNECTOR",
          { jobId: job.id, connectorId: device.configuration?.connectorId },
          params.actorId,
        ),
      );
      return {
        job,
        duplicate: false,
        warning: device.configuration?.host
          ? undefined
          : "Connector printer host not configured — job queued until connector is online and configured.",
      };
    }

    const processed = await this.processPrintJob(params.restaurantId, job.id, params.actorId);
    return { job: processed.job, duplicate: false, warning: processed.warning };
  }

  async processPrintJob(
    restaurantId: string,
    jobId: string,
    actorId?: string,
  ): Promise<{ job: PrintJobRecord; warning?: string }> {
    const job = await deviceRepository.findJob(restaurantId, jobId);
    if (!job) throw new DeviceServiceError("Print job not found.", 404);
    if (job.status === "COMPLETED" || job.status === "CANCELLED") {
      return { job };
    }
    if (job.status === "UNKNOWN" || job.status === "MANUAL_REVIEW") {
      return {
        job,
        warning: "Job requires manual review — automatic retry blocked for uncertain outcomes.",
      };
    }

    const device = await this.get(restaurantId, job.deviceId);
    if (device.adapterType === "CONNECTOR") {
      // Reset to QUEUED so connector can reclaim; never auto-complete in cloud.
      const queued =
        (await deviceRepository.updateJob(restaurantId, jobId, {
          status: "QUEUED",
          errorMessage: undefined,
        })) ?? job;
      return { job: queued, warning: "Job re-queued for local connector." };
    }

    await deviceRepository.updateJob(restaurantId, jobId, {
      status: "PROCESSING",
      attemptCount: job.attemptCount + 1,
    });

    const result = await runDeviceCommand(device, {
      name: "PRINT",
      payload: {
        ...job.payloadSnapshot,
        jobType: job.jobType,
        isReprint: job.isReprint,
      },
    });

    await deviceRepository.insertEvent(
      makeDeviceEvent(device, "PRINT_JOB", { jobId, result }, actorId),
    );

    if (result.ok && result.status !== "PENDING") {
      const completed =
        (await deviceRepository.updateJob(restaurantId, jobId, {
          status: "COMPLETED",
          completedAt: new Date().toISOString(),
          errorMessage: undefined,
        })) ?? job;
      return { job: completed };
    }

    if (result.status === "PENDING") {
      const queued =
        (await deviceRepository.updateJob(restaurantId, jobId, {
          status: "QUEUED",
        })) ?? job;
      return { job: queued };
    }

    const attempts = job.attemptCount + 1;
    void attempts;
    void isRecoverablePrintError(result.errorCode);
    const failed =
      (await deviceRepository.updateJob(restaurantId, jobId, {
        status: "FAILED",
        errorMessage: result.message,
      })) ?? job;

    return {
      job: failed,
      warning: `Print job failed: ${result.message}`,
    };
  }

  async retryPrintJob(restaurantId: string, jobId: string, actorId?: string) {
    const job = await deviceRepository.findJob(restaurantId, jobId);
    if (!job) throw new DeviceServiceError("Print job not found.", 404);
    if (job.status === "COMPLETED") return { job, warning: undefined };
    if (job.status === "UNKNOWN" || job.status === "MANUAL_REVIEW") {
      throw new DeviceServiceError(
        "Uncertain print outcomes require manual review before reprint.",
        409,
        "MANUAL_REVIEW",
      );
    }
    if (job.attemptCount >= job.maxAttempts) {
      throw new DeviceServiceError("Max print attempts reached.", 409, "MAX_ATTEMPTS");
    }
    return this.processPrintJob(restaurantId, jobId, actorId);
  }

  /** Non-blocking POS receipt helper — never throws on device failure. */
  async tryEnqueueReceiptForOrder(
    order: RestaurantOrder,
    opts: { outletId: string; isReprint?: boolean; actorId?: string },
  ): Promise<{ warning?: string; jobId?: string; warnings?: string[] }> {
    try {
      const devices = await deviceRepository.listDevices(order.restaurantId, opts.outletId);
      const route = routeReceiptPrinter(devices);
      const printer = route.primary;
      if (!printer) return { warning: route.warnings.join(" ") || "No receipt printer configured." };
      const { job, warning } = await this.enqueuePrintJob({
        restaurantId: order.restaurantId,
        outletId: opts.outletId,
        deviceId: printer.id,
        orderId: order.id,
        jobType: jobTypeForRoute("receipt", opts.isReprint),
        isReprint: opts.isReprint,
        actorId: opts.actorId,
        payload: {
          orderNumber: order.orderNumber,
          isReprint: Boolean(opts.isReprint),
          items: order.items.map((i) => ({
            name: i.dishNameSnapshot,
            qty: i.quantity,
            total: i.itemTotal,
          })),
          subtotal: order.subtotal,
          discount: order.billDiscountAmount ?? 0,
          tax: order.taxAmount ?? 0,
          total: order.total,
          paymentStatus: order.payment?.status,
          qrPayload: order.id,
        },
      });
      const warnings = [...route.warnings, ...(warning ? [warning] : [])];
      if (route.fallback) {
        warnings.push(
          `Fallback printer available: ${route.fallback.name} (not auto-printed — use authorized retry).`,
        );
      }
      return { jobId: job.id, warning: warnings.length ? warnings.join(" ") : undefined, warnings };
    } catch (cause) {
      return {
        warning: cause instanceof Error ? cause.message : "Receipt print enqueue failed",
      };
    }
  }

  /** Non-blocking KOT enqueue by kitchen station. */
  async tryEnqueueKotForOrder(
    order: RestaurantOrder,
    opts: {
      outletId: string;
      jobType?: PrintJobType;
      isReprint?: boolean;
      actorId?: string;
      stations?: string[];
    },
  ): Promise<{ warnings: string[]; jobIds: string[] }> {
    const warnings: string[] = [];
    const jobIds: string[] = [];
    try {
      const devices = await deviceRepository.listDevices(order.restaurantId, opts.outletId);
      const stations = new Set(
        opts.stations ??
          order.items.map((i) => i.kitchenStation ?? "MAIN").filter(Boolean),
      );
      for (const station of stations) {
        const route = routeKotPrinter(devices, station);
        warnings.push(...route.warnings);
        const printer = route.primary;
        if (!printer) continue;
        if (route.fallback) {
          warnings.push(
            `Fallback for ${station}: ${route.fallback.name} (authorized retry only).`,
          );
        }
        const items = order.items.filter((i) => (i.kitchenStation ?? "MAIN") === station);
        const { job, warning } = await this.enqueuePrintJob({
          restaurantId: order.restaurantId,
          outletId: opts.outletId,
          deviceId: printer.id,
          orderId: order.id,
          jobType: opts.jobType ?? jobTypeForRoute("kot", opts.isReprint),
          isReprint: opts.isReprint,
          actorId: opts.actorId,
          payload: {
            orderNumber: order.orderNumber,
            station,
            isReprint: Boolean(opts.isReprint),
            items: (items.length ? items : order.items).map((i) => ({
              name: i.dishNameSnapshot,
              qty: i.quantity,
              notes: i.note,
            })),
          },
        });
        jobIds.push(job.id);
        if (warning) warnings.push(warning);
      }
    } catch (cause) {
      warnings.push(cause instanceof Error ? cause.message : "KOT enqueue failed");
    }
    return { warnings, jobIds };
  }

  findDefaultDevice(restaurantId: string, outletId: string, type: DeviceType) {
    return deviceRepository
      .listDevices(restaurantId, outletId)
      .then((list) => list.find((d) => d.deviceType === type && d.enabled) ?? null);
  }
}

export const deviceService = new DeviceService();

export type { DeviceCommandName };
