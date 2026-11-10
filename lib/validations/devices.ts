import { z } from "zod";

export const deviceCommandSchema = z
  .object({
    name: z.enum([
      "PRINT",
      "OPEN_DRAWER",
      "CLOSE_DRAWER",
      "SCAN",
      "DISPLAY_UPDATE",
      "PAYMENT_REQUEST",
      "PAYMENT_CANCEL",
      "HEALTH_CHECK",
      "SIMULATE_PAPER_OUT",
      "SIMULATE_OFFLINE",
      "SIMULATE_RECOVER",
      "SIMULATE_PRINT_FAIL",
    ]),
    payload: z.record(z.string(), z.unknown()).optional(),
    timeoutMs: z.number().int().positive().max(30_000).optional(),
    idempotencyKey: z.string().max(120).optional(),
  })
  .strict();

export const registerSampleDevicesSchema = z
  .object({
    outletId: z.string().min(1).optional(),
  })
  .strict();

export const updateDeviceSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    kitchenStation: z.string().trim().min(1).max(40).optional(),
    printerRole: z
      .enum(["RECEIPT", "KITCHEN", "BAR", "SECONDARY_RECEIPT", "OTHER"])
      .optional(),
    outletId: z.string().min(1).optional(),
    configuration: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const registerPrinterSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    deviceType: z.enum(["RECEIPT_PRINTER", "KITCHEN_PRINTER"]),
    printerRole: z
      .enum(["RECEIPT", "KITCHEN", "BAR", "SECONDARY_RECEIPT", "OTHER"])
      .optional(),
    kitchenStation: z.string().trim().min(1).max(40).optional(),
    manufacturer: z.string().trim().max(80).optional(),
    model: z.string().trim().max(80).optional(),
    outletId: z.string().min(1).optional(),
    connectorId: z.string().min(1).optional(),
    configuration: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const assignDeviceConnectorSchema = z
  .object({
    connectorId: z.string().min(1),
    outletId: z.string().min(1).optional(),
  })
  .strict();

export const authorizedFallbackSchema = z
  .object({
    fallbackDeviceId: z.string().min(1),
    outletId: z.string().min(1).optional(),
  })
  .strict();
