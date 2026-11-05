/**
 * Pilot verification labels (Phase 6.3).
 * Prefer these four statuses in UI/docs. Legacy ADAPTER_IMPLEMENTED / AUTOMATED_TESTED
 * map to IMPLEMENTED_NOT_VERIFIED semantics — never invent PHYSICALLY_VERIFIED.
 */
export type CompatibilityVerificationStatus =
  | "SIMULATED"
  | "IMPLEMENTED_NOT_VERIFIED"
  | "PHYSICALLY_VERIFIED"
  | "UNSUPPORTED"
  /** @deprecated Prefer IMPLEMENTED_NOT_VERIFIED */
  | "ADAPTER_IMPLEMENTED"
  /** @deprecated Prefer IMPLEMENTED_NOT_VERIFIED */
  | "AUTOMATED_TESTED";

export function normalizeVerificationStatus(
  status: CompatibilityVerificationStatus,
): "SIMULATED" | "IMPLEMENTED_NOT_VERIFIED" | "PHYSICALLY_VERIFIED" | "UNSUPPORTED" {
  if (status === "ADAPTER_IMPLEMENTED" || status === "AUTOMATED_TESTED") {
    return "IMPLEMENTED_NOT_VERIFIED";
  }
  return status;
}

export type HardwareCompatibilityProfile = {
  id: string;
  manufacturer: string;
  model: string;
  category: "RECEIPT_PRINTER" | "KITCHEN_PRINTER" | "CASH_DRAWER" | "BARCODE_SCANNER";
  connectionType: "NETWORK" | "USB" | "KEYBOARD_WEDGE" | "SIMULATOR";
  protocol: string;
  capabilities: string[];
  knownLimitations: string[];
  adapterVersion: string;
  verificationStatus: CompatibilityVerificationStatus;
  notes?: string;
};

/** Initial profiles — no fabricated manufacturer certifications. */
export const HARDWARE_COMPATIBILITY_REGISTRY: HardwareCompatibilityProfile[] = [
  {
    id: "generic-escpos-network-80",
    manufacturer: "Generic",
    model: "ESC/POS Network 80mm",
    category: "RECEIPT_PRINTER",
    connectionType: "NETWORK",
    protocol: "ESC/POS TCP :9100",
    capabilities: ["text", "cut(optional)", "drawerKick(optional)", "align", "bold"],
    knownLimitations: [
      "QR/barcode require capability flags",
      "Cut command ignored on some models",
      "Character sets vary; ascii safest",
    ],
    adapterVersion: "0.2.0",
    verificationStatus: "IMPLEMENTED_NOT_VERIFIED",
    notes: "TCP mock + payload unit tests. Not physically verified.",
  },
  {
    id: "generic-escpos-network-58",
    manufacturer: "Generic",
    model: "ESC/POS Network 58mm",
    category: "RECEIPT_PRINTER",
    connectionType: "NETWORK",
    protocol: "ESC/POS TCP :9100",
    capabilities: ["text", "cut(optional)", "align", "bold"],
    knownLimitations: ["Narrow width truncates long item names"],
    adapterVersion: "0.2.0",
    verificationStatus: "IMPLEMENTED_NOT_VERIFIED",
  },
  {
    id: "tronx-simulator-suite",
    manufacturer: "TRONX",
    model: "Simulator Suite",
    category: "RECEIPT_PRINTER",
    connectionType: "SIMULATOR",
    protocol: "in-process",
    capabilities: ["all simulated commands"],
    knownLimitations: ["Not physical hardware"],
    adapterVersion: "6.0.0",
    verificationStatus: "SIMULATED",
  },
  {
    id: "usb-printer-stub",
    manufacturer: "Generic",
    model: "USB ESC/POS",
    category: "RECEIPT_PRINTER",
    connectionType: "USB",
    protocol: "Winspool/raw (planned)",
    capabilities: [],
    knownLimitations: ["Adapter stub only"],
    adapterVersion: "0.0.0",
    verificationStatus: "UNSUPPORTED",
  },
  {
    id: "keyboard-wedge-scanner",
    manufacturer: "Generic",
    model: "Keyboard-wedge barcode",
    category: "BARCODE_SCANNER",
    connectionType: "KEYBOARD_WEDGE",
    protocol: "HID keyboard",
    capabilities: ["rapid key bursts", "Enter/Tab suffix"],
    knownLimitations: ["Depends on host focus; no stock mutation"],
    adapterVersion: "0.2.0",
    verificationStatus: "IMPLEMENTED_NOT_VERIFIED",
  },
];
