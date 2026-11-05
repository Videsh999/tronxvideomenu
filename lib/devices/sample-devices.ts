import { randomUUID } from "crypto";
import { defaultPrinterRole } from "@/lib/devices/printer-roles";
import type { DeviceRecord, DeviceType, PrinterRole } from "@/lib/devices/device.types";

const SAMPLES: Array<{
  deviceType: DeviceType;
  name: string;
  manufacturer: string;
  model: string;
  capabilities: string[];
  kitchenStation?: string;
  printerRole?: PrinterRole;
}> = [
  {
    deviceType: "RECEIPT_PRINTER",
    name: "Sim Receipt Printer",
    manufacturer: "TRONX",
    model: "SIM-R80",
    capabilities: ["PRINT_RECEIPT", "PRINT_BILL", "REPRINT"],
    printerRole: "RECEIPT",
  },
  {
    deviceType: "KITCHEN_PRINTER",
    name: "Sim Kitchen Printer · MAIN",
    manufacturer: "TRONX",
    model: "SIM-K80",
    capabilities: ["PRINT_KOT", "STATION_ROUTE"],
    kitchenStation: "MAIN",
    printerRole: "KITCHEN",
  },
  {
    deviceType: "KITCHEN_PRINTER",
    name: "Sim Kitchen Printer · BAR",
    manufacturer: "TRONX",
    model: "SIM-K80",
    capabilities: ["PRINT_KOT", "STATION_ROUTE"],
    kitchenStation: "BAR",
    printerRole: "BAR",
  },
  {
    deviceType: "CASH_DRAWER",
    name: "Sim Cash Drawer",
    manufacturer: "TRONX",
    model: "SIM-CD1",
    capabilities: ["OPEN", "CLOSE"],
  },
  {
    deviceType: "BARCODE_SCANNER",
    name: "Sim Barcode Scanner",
    manufacturer: "TRONX",
    model: "SIM-BC1",
    capabilities: ["SCAN"],
  },
  {
    deviceType: "PAYMENT_TERMINAL",
    name: "Sim Payment Terminal",
    manufacturer: "TRONX",
    model: "SIM-PT1",
    capabilities: ["APPROVE", "DECLINE", "TIMEOUT"],
  },
  {
    deviceType: "CUSTOMER_DISPLAY",
    name: "Sim Customer Display",
    manufacturer: "TRONX",
    model: "SIM-CDISP",
    capabilities: ["DISPLAY_ORDER"],
  },
];

export function buildSampleSimulatorDevices(params: {
  restaurantId: string;
  outletId: string;
  organizationId?: string;
}): DeviceRecord[] {
  const now = new Date().toISOString();
  return SAMPLES.map((sample) => ({
    id: `dev-${randomUUID()}`,
    organizationId: params.organizationId,
    restaurantId: params.restaurantId,
    outletId: params.outletId,
    name: sample.name,
    deviceType: sample.deviceType,
    manufacturer: sample.manufacturer,
    model: sample.model,
    connectionType: "SIMULATOR",
    adapterType: "SIMULATOR",
    connectionStatus: "CONNECTED",
    healthStatus: "HEALTHY",
    lastSeenAt: now,
    capabilities: sample.capabilities,
    configuration: { mode: "SIMULATOR" },
    simulated: true,
    enabled: true,
    kitchenStation: sample.kitchenStation,
    printerRole: sample.printerRole ?? defaultPrinterRole(sample.deviceType),
    createdAt: now,
    updatedAt: now,
  }));
}
