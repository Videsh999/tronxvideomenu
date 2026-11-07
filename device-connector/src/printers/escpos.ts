import { createConnection } from "node:net";
import { createHash } from "node:crypto";

export type PaperWidthMm = 58 | 80;

export type EscPosCapabilities = {
  cut: boolean;
  bold: boolean;
  align: boolean;
  qrCode: boolean;
  barcode: boolean;
  drawerKick: boolean;
};

export type EscPosPrinterConfig = {
  host: string;
  port: number;
  paperWidth?: PaperWidthMm | number;
  encoding?: string;
  timeoutMs?: number;
  connectTimeoutMs?: number;
  writeTimeoutMs?: number;
  brandName?: string;
  footerLines?: string[];
  capabilities?: Partial<EscPosCapabilities>;
};

export type PrintOutcome =
  | { status: "COMPLETED"; bytesSent: number; payloadHash: string }
  | { status: "FAILED"; errorMessage: string; errorCode: string }
  | { status: "UNKNOWN"; errorMessage: string; bytesSent: number; payloadHash: string };

const ESC = 0x1b;
const GS = 0x1d;

const DEFAULT_CAPS: EscPosCapabilities = {
  cut: true,
  bold: true,
  align: true,
  qrCode: false,
  barcode: false,
  drawerKick: true,
};

function charsForWidth(width: number): number {
  return width === 58 ? 32 : 42;
}

function resolveCaps(config: EscPosPrinterConfig): EscPosCapabilities {
  return { ...DEFAULT_CAPS, ...(config.capabilities ?? {}) };
}

function encodeText(text: string, encoding: string): number[] {
  if (encoding === "utf8" || encoding === "utf-8") return [...Buffer.from(text, "utf8")];
  const out: number[] = [];
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    out.push(code <= 0xff ? code : 0x3f);
  }
  return out;
}

function padLine(left: string, right: string, width: number): string {
  const gap = Math.max(1, width - left.length - right.length);
  return `${left}${" ".repeat(gap)}${right}`.slice(0, width);
}

function money(value: unknown): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "";
  return n.toFixed(2);
}

export function buildDocumentBytes(
  kind: "RECEIPT" | "KOT" | "TEST_PAGE",
  payload: Record<string, unknown>,
  config: EscPosPrinterConfig,
): { bytes: Buffer; unsupported: string[] } {
  const width = Number(config.paperWidth) === 58 ? 58 : 80;
  const w = charsForWidth(width);
  const caps = resolveCaps(config);
  const encoding = String(config.encoding ?? "ascii");
  const brand = config.brandName ?? "TRONX";
  const unsupported: string[] = [];
  const chunks: number[] = [];
  const push = (...b: number[]) => chunks.push(...b);
  const line = (text: string) => {
    push(...encodeText(text, encoding), 0x0a);
  };

  push(ESC, 0x40);
  if (caps.align) push(ESC, 0x61, 0x01);
  else unsupported.push("align");
  if (caps.bold) push(ESC, 0x45, 0x01);
  else unsupported.push("bold");
  line(kind === "KOT" ? "KITCHEN TICKET" : kind === "TEST_PAGE" ? `${brand} TEST` : `${brand} RECEIPT`);
  if (caps.bold) push(ESC, 0x45, 0x00);
  if (caps.align) push(ESC, 0x61, 0x00);
  if (payload.isReprint) line("*** REPRINT ***");
  line(`Order #${payload.orderNumber ?? "—"}`);
  if (payload.location) line(String(payload.location).slice(0, w));
  if (payload.station) line(`Station ${payload.station}`);
  line("-".repeat(Math.min(w, 42)));
  const items = Array.isArray(payload.items) ? payload.items : [];
  for (const item of items) {
    const row = item as { qty?: number; name?: string; total?: number; notes?: string };
    if (kind === "KOT") {
      line(padLine(`${row.qty ?? 1}x ${row.name ?? "Item"}`.slice(0, w - 10), money(row.total), w));
      if (row.notes) line(`  ${row.notes}`.slice(0, w));
    } else {
      line(padLine(`${row.qty ?? 1}x ${row.name ?? "Item"}`.slice(0, w - 8), money(row.total), w));
    }
  }
  if (kind !== "KOT") {
    line("-".repeat(Math.min(w, 42)));
    if (payload.subtotal != null) line(padLine("Subtotal", money(payload.subtotal), w));
    if (payload.discount != null && Number(payload.discount) !== 0) {
      line(padLine("Discount", `-${money(payload.discount)}`, w));
    }
    if (payload.tax != null) line(padLine("Tax", money(payload.tax), w));
    if (caps.bold) push(ESC, 0x45, 0x01);
    if (payload.total != null) line(padLine("TOTAL", money(payload.total), w));
    if (caps.bold) push(ESC, 0x45, 0x00);
    if (payload.paymentStatus) line(`Payment ${payload.paymentStatus}`);
  } else {
    line("-".repeat(Math.min(w, 42)));
    if (payload.subtotal != null) line(padLine("Subtotal", money(payload.subtotal), w));
    if (payload.discount != null && Number(payload.discount) !== 0) line(padLine("Discount", `-${money(payload.discount)}`, w));
    if (payload.tax != null) line(padLine("Tax", money(payload.tax), w));
    if (caps.bold) push(ESC, 0x45, 0x01);
    if (payload.total != null) line(padLine("TOTAL", money(payload.total), w));
    if (caps.bold) push(ESC, 0x45, 0x00);
  }
  if (payload.qrPayload) {
    if (caps.qrCode) {
      const data = Buffer.from(String(payload.qrPayload), "utf8");
      const storeLen = data.length + 3;
      push(GS, 0x28, 0x6b, storeLen & 0xff, (storeLen >> 8) & 0xff, 0x31, 0x50, 0x30, ...data);
      push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    } else {
      unsupported.push("qrCode");
      line(`Ref: ${String(payload.qrPayload).slice(0, w)}`);
    }
  }
  for (const footer of config.footerLines ?? ["Thank you", "Powered by TRONX"]) {
    line(String(footer).slice(0, w));
  }
  line(`Width ${width}mm · ${encoding}`);
  push(ESC, 0x64, 0x03);
  if (caps.cut) push(GS, 0x56, 0x00);
  else unsupported.push("cut");
  return { bytes: Buffer.from(chunks), unsupported };
}

export function buildReceiptBytes(
  payload: Record<string, unknown>,
  config: EscPosPrinterConfig = { host: "", port: 9100 },
): Buffer {
  return buildDocumentBytes("RECEIPT", payload, config).bytes;
}

export function buildKotBytes(
  payload: Record<string, unknown>,
  config: EscPosPrinterConfig = { host: "", port: 9100 },
): Buffer {
  return buildDocumentBytes("KOT", payload, config).bytes;
}

export function buildTestPageBytes(config: EscPosPrinterConfig = { host: "", port: 9100 }): Buffer {
  return buildDocumentBytes(
    "TEST_PAGE",
    { orderNumber: "TEST", items: [{ name: "TRONX Connector Test", qty: 1, total: 0 }], total: 0 },
    config,
  ).bytes;
}

export function buildDrawerKickBytes(config?: EscPosPrinterConfig): Buffer | null {
  const caps = resolveCaps(config ?? { host: "", port: 9100 });
  if (!caps.drawerKick) return null;
  return Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]);
}

export function payloadHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export function validatePrinterConfig(config: Partial<EscPosPrinterConfig>): string | null {
  if (!config.host || typeof config.host !== "string") return "host is required";
  if (config.port != null && (config.port < 1 || config.port > 65535)) return "invalid port";
  if (config.paperWidth != null && config.paperWidth !== 58 && config.paperWidth !== 80) {
    return "paperWidth must be 58 or 80";
  }
  return null;
}

/**
 * Send raw bytes. Separate connect vs write timeout awareness.
 * If bytes were written and then error/timeout → UNKNOWN (may have printed).
 */
export function sendEscPos(
  config: EscPosPrinterConfig,
  data: Buffer,
  payload: Record<string, unknown>,
): Promise<PrintOutcome> {
  const hash = payloadHash(payload);
  if (!config.host) {
    return Promise.resolve({
      status: "FAILED",
      errorMessage: "Printer host not configured",
      errorCode: "NOT_CONFIGURED",
    });
  }

  const connectTimeoutMs = config.connectTimeoutMs ?? config.timeoutMs ?? 5_000;
  const writeTimeoutMs = config.writeTimeoutMs ?? config.timeoutMs ?? 8_000;

  return new Promise((resolve) => {
    let settled = false;
    let wrote = false;
    let connected = false;
    const socket = createConnection({ host: config.host, port: config.port || 9100 });

    const finish = (outcome: PrintOutcome) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(outcome);
    };

    const connectTimer = setTimeout(() => {
      if (!connected) {
        finish({
          status: "FAILED",
          errorMessage: "Printer connection timeout",
          errorCode: "CONNECT_TIMEOUT",
        });
      }
    }, connectTimeoutMs);

    let writeTimer: NodeJS.Timeout | undefined;

    socket.on("connect", () => {
      connected = true;
      clearTimeout(connectTimer);
      writeTimer = setTimeout(() => {
        if (wrote) {
          finish({
            status: "UNKNOWN",
            errorMessage: "Write timeout after send — print may have succeeded; manual review required",
            bytesSent: data.length,
            payloadHash: hash,
          });
        } else {
          finish({
            status: "FAILED",
            errorMessage: "Printer write timeout",
            errorCode: "WRITE_TIMEOUT",
          });
        }
      }, writeTimeoutMs);

      socket.write(data, (err) => {
        if (err) {
          if (writeTimer) clearTimeout(writeTimer);
          finish({
            status: wrote ? "UNKNOWN" : "FAILED",
            errorMessage: err.message,
            errorCode: "WRITE_ERROR",
            ...(wrote ? { bytesSent: data.length, payloadHash: hash } : {}),
          } as PrintOutcome);
          return;
        }
        wrote = true;
        socket.end(() => {
          if (writeTimer) clearTimeout(writeTimer);
          finish({ status: "COMPLETED", bytesSent: data.length, payloadHash: hash });
        });
      });
    });

    socket.on("error", (err) => {
      clearTimeout(connectTimer);
      if (writeTimer) clearTimeout(writeTimer);
      if (wrote) {
        finish({
          status: "UNKNOWN",
          errorMessage: err.message,
          bytesSent: data.length,
          payloadHash: hash,
        });
      } else {
        finish({
          status: "FAILED",
          errorMessage: err.message,
          errorCode: "CONNECT_ERROR",
        });
      }
    });
  });
}
