/**
 * USB printer adapter contract (Windows).
 *
 * Status: INTERFACE ONLY — not verified against physical USB printers in this environment.
 * Production support requires a Windows build with a supported raw-USB / Winspool path
 * and on-site hardware verification before claiming COMPLETE.
 */

export type UsbPrinterInfo = {
  devicePath: string;
  manufacturer?: string;
  model?: string;
  vendorId?: string;
  productId?: string;
};

export interface UsbPrinterAdapter {
  listPrinters(): Promise<UsbPrinterInfo[]>;
  testPrint(devicePath?: string): Promise<{ ok: boolean; message: string }>;
  printRaw(devicePath: string, data: Buffer): Promise<{
    status: "COMPLETED" | "FAILED" | "UNKNOWN";
    message: string;
  }>;
}

/** Stub that reports USB as unavailable until Windows verification. */
export class UnsupportedUsbPrinterAdapter implements UsbPrinterAdapter {
  async listPrinters(): Promise<UsbPrinterInfo[]> {
    return [];
  }

  async testPrint(_devicePath?: string): Promise<{ ok: boolean; message: string }> {
    return {
      ok: false,
      message:
        "USB printing is not enabled in this build. Use network ESC/POS (port 9100) or verify Winspool integration on Windows hardware.",
    };
  }

  async printRaw(_devicePath: string, _data: Buffer): Promise<{ status: "FAILED"; message: string }> {
    return {
      status: "FAILED",
      message: "USB adapter not implemented/verified in this environment.",
    };
  }
}
