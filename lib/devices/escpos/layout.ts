import type { EscPosPrinterProfile } from "@/lib/devices/escpos/capabilities";

const ESC = 0x1b;
const GS = 0x1d;

export type PrintDocumentKind = "RECEIPT" | "KOT" | "TEST_PAGE" | "REPRINT_RECEIPT" | "REPRINT_KOT";

export type PrintDocumentInput = {
  kind: PrintDocumentKind;
  orderNumber?: string | number;
  location?: string;
  station?: string;
  isReprint?: boolean;
  items?: Array<{ name?: string; qty?: number; total?: number; notes?: string }>;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  paymentStatus?: string;
  qrPayload?: string;
};

function encodeText(text: string, encoding: EscPosPrinterProfile["encoding"]): number[] {
  if (encoding === "utf8") {
    return [...Buffer.from(text, "utf8")];
  }
  // ascii / cp437 best-effort: strip non-latin1
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

function money(value: number | undefined): string {
  if (value == null || Number.isNaN(value)) return "";
  return Number(value).toFixed(2);
}

function separator(width: number): string {
  return "-".repeat(Math.min(width, 48));
}

/** Build ESC/POS bytes using only enabled capabilities. */
export function buildEscPosDocument(
  input: PrintDocumentInput,
  profile: EscPosPrinterProfile,
): { bytes: Buffer; previewLines: string[]; unsupported: string[] } {
  const chunks: number[] = [];
  const preview: string[] = [];
  const unsupported: string[] = [];
  const w = profile.charsPerLine;
  const push = (...b: number[]) => chunks.push(...b);
  const line = (text: string) => {
    preview.push(text);
    push(...encodeText(text, profile.encoding), 0x0a);
  };

  push(ESC, 0x40); // init

  if (profile.capabilities.align) push(ESC, 0x61, 0x01);
  else unsupported.push("align");

  if (profile.capabilities.bold) push(ESC, 0x45, 0x01);
  const title =
    input.kind === "TEST_PAGE"
      ? `${profile.brandName} TEST`
      : input.kind.startsWith("KOT") || input.kind === "REPRINT_KOT"
        ? "KITCHEN TICKET"
        : `${profile.brandName} RECEIPT`;
  line(title);
  if (profile.capabilities.bold) push(ESC, 0x45, 0x00);
  else if (!profile.capabilities.bold) unsupported.push("bold");

  if (profile.capabilities.align) push(ESC, 0x61, 0x00);

  if (input.isReprint || input.kind.startsWith("REPRINT")) line("*** REPRINT ***");
  if (input.orderNumber != null) line(`Order #${input.orderNumber}`);
  if (input.location) line(input.location);
  if (input.station) line(`Station ${input.station}`);
  line(separator(w));

  for (const item of input.items ?? []) {
    const qty = item.qty ?? 1;
    const name = String(item.name ?? "Item");
    if (input.kind.startsWith("KOT") || input.kind === "REPRINT_KOT") {
      line(padLine(`${qty}x ${name}`.slice(0, w - 10), money(item.total), w));
      if (item.notes) line(`  ${item.notes}`.slice(0, w));
    } else {
      line(padLine(`${qty}x ${name}`.slice(0, w - 8), money(item.total), w));
    }
  }

  if (!input.kind.startsWith("KOT") && input.kind !== "REPRINT_KOT") {
    line(separator(w));
    if (input.subtotal != null) line(padLine("Subtotal", money(input.subtotal), w));
    if (input.discount != null && Number(input.discount) !== 0) {
      line(padLine("Discount", `-${money(input.discount)}`, w));
    }
    if (input.tax != null) line(padLine("Tax", money(input.tax), w));
    if (profile.capabilities.bold) push(ESC, 0x45, 0x01);
    if (input.total != null) line(padLine("TOTAL", money(input.total), w));
    if (profile.capabilities.bold) push(ESC, 0x45, 0x00);
    if (input.paymentStatus) line(`Payment ${input.paymentStatus}`);
  } else {
    line(separator(w));
    if (input.subtotal != null) line(padLine("Subtotal", money(input.subtotal), w));
    if (input.discount != null && Number(input.discount) !== 0) line(padLine("Discount", `-${money(input.discount)}`, w));
    if (input.tax != null) line(padLine("Tax", money(input.tax), w));
    if (profile.capabilities.bold) push(ESC, 0x45, 0x01);
    if (input.total != null) line(padLine("TOTAL", money(input.total), w));
    if (profile.capabilities.bold) push(ESC, 0x45, 0x00);
  }

  if (input.qrPayload) {
    if (profile.capabilities.qrCode) {
      // Minimal QR model 2 store — many printers ignore if unsupported; gated by capability.
      const data = Buffer.from(String(input.qrPayload), "utf8");
      const storeLen = data.length + 3;
      const pL = storeLen & 0xff;
      const pH = (storeLen >> 8) & 0xff;
      push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...data);
      push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
      preview.push(`[QR] ${input.qrPayload}`);
    } else {
      unsupported.push("qrCode");
      line(`Ref: ${String(input.qrPayload).slice(0, w)}`);
    }
  }

  for (const footer of profile.footerLines ?? []) line(footer.slice(0, w));
  line(`Width ${profile.paperWidthMm}mm · ${profile.encoding}`);
  push(ESC, 0x64, 0x03);
  if (profile.capabilities.cut) push(GS, 0x56, 0x00);
  else unsupported.push("cut");

  return { bytes: Buffer.from(chunks), previewLines: preview, unsupported: [...new Set(unsupported)] };
}

export function buildDrawerKick(profile: EscPosPrinterProfile): {
  bytes: Buffer | null;
  unsupported: string[];
} {
  if (!profile.capabilities.drawerKick) {
    return { bytes: null, unsupported: ["drawerKick"] };
  }
  return { bytes: Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]), unsupported: [] };
}
