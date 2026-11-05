/** Evidence-based ESC/POS capability flags — never assume full support. */

export type PaperWidthMm = 58 | 80;

export type EscPosCapabilities = {
  cut: boolean;
  bold: boolean;
  align: boolean;
  qrCode: boolean;
  barcode: boolean;
  drawerKick: boolean;
  codePage: boolean;
};

export type EscPosPrinterProfile = {
  paperWidthMm: PaperWidthMm;
  encoding: "ascii" | "utf8" | "cp437";
  capabilities: EscPosCapabilities;
  brandName?: string;
  footerLines?: string[];
  charsPerLine: number;
};

export const DEFAULT_CAPABILITIES: EscPosCapabilities = {
  cut: true,
  bold: true,
  align: true,
  qrCode: false,
  barcode: false,
  drawerKick: true,
  codePage: false,
};

export function charsForWidth(width: PaperWidthMm): number {
  return width === 58 ? 32 : 42;
}

export function resolveProfile(config: Record<string, unknown> = {}): EscPosPrinterProfile {
  const paperWidthMm = (Number(config.paperWidth) === 58 ? 58 : 80) as PaperWidthMm;
  const encodingRaw = String(config.encoding ?? "ascii").toLowerCase();
  const encoding =
    encodingRaw === "utf8" || encodingRaw === "utf-8"
      ? "utf8"
      : encodingRaw === "cp437"
        ? "cp437"
        : "ascii";
  const caps = {
    ...DEFAULT_CAPABILITIES,
    ...(typeof config.capabilities === "object" && config.capabilities
      ? (config.capabilities as Partial<EscPosCapabilities>)
      : {}),
  };
  return {
    paperWidthMm,
    encoding,
    capabilities: caps,
    brandName: typeof config.brandName === "string" ? config.brandName : "TRONX",
    footerLines: Array.isArray(config.footerLines)
      ? config.footerLines.map(String)
      : ["Thank you", "Powered by TRONX"],
    charsPerLine: charsForWidth(paperWidthMm),
  };
}

export function validatePrinterConfiguration(config: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const host = String(config.host ?? "").trim();
  if (!host) errors.push("Printer IP/host is required.");
  const port = Number(config.port ?? 9100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push("Port must be 1–65535.");
  const width = Number(config.paperWidth ?? 80);
  if (width !== 58 && width !== 80) errors.push("Paper width must be 58 or 80 mm.");
  return errors;
}
