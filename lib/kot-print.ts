import type { OrderSummary } from "@/types";
import { jsPDF } from "jspdf";
import { formatOrderClock } from "@/lib/order-board";
import { orderLocationName } from "@/lib/service-location";

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function money(value: number) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

/** Pure ticket markup used by browser/mobile printing and regression tests. */
export function buildKitchenOrderTicketHtml(order: OrderSummary, restaurantName = "TRONX") {
  const itemsHtml = order.items.map((item) => {
    const activeQuantity = Math.max(0, item.quantity - (item.cancelledQuantity ?? 0));
    const addons = item.addons.map((addon) => `<div class="detail">+ ${escapeHtml(addon.nameSnapshot)}${addon.quantity > 1 ? ` × ${addon.quantity}` : ""} · ${money(addon.total)}</div>`).join("");
    const variant = item.variantNameSnapshot ? `<div class="detail">Variant: ${escapeHtml(item.variantNameSnapshot)}</div>` : "";
    const note = item.note ? `<div class="note">NOTE: ${escapeHtml(item.note)}</div>` : "";
    const cancelled = item.cancelledQuantity ? `<div class="cancelled">Cancelled: ${item.cancelledQuantity}</div>` : "";
    return `<tr><td class="qty">${activeQuantity}×</td><td class="item"><div class="dish">${escapeHtml(item.dishNameSnapshot)}</div>${variant}${addons}${note}${cancelled}</td><td class="price"><div>${money(item.unitPriceSnapshot)}</div><strong>${money(item.itemTotal)}</strong></td></tr>`;
  }).join("");
  const discount = order.billDiscountAmount ?? 0;
  return `<section class="kot-ticket" aria-label="Kitchen order ticket ${order.orderNumber}"><header><div class="brand">${escapeHtml(restaurantName)}</div><div class="kind">KITCHEN ORDER TICKET</div><div class="order-number">ORDER #${escapeHtml(String(order.orderNumber))}</div><div class="location">${escapeHtml(orderLocationName(order))}</div><div class="meta">${escapeHtml(formatOrderClock(order.createdAt))} · ${escapeHtml((order.source ?? order.channel ?? "ORDER").replace(/_/g, " "))}</div></header><div class="rule"></div><table><thead><tr><th>Qty</th><th>Item</th><th class="price">Price</th></tr></thead><tbody>${itemsHtml}</tbody></table><div class="rule"></div><dl class="totals"><div><dt>Subtotal</dt><dd>${money(order.subtotal)}</dd></div>${discount > 0 ? `<div><dt>Discount</dt><dd>−${money(discount)}</dd></div>` : ""}${(order.packagingCharge ?? 0) > 0 ? `<div><dt>Packaging</dt><dd>${money(order.packagingCharge ?? 0)}</dd></div>` : ""}${(order.serviceCharge ?? 0) > 0 ? `<div><dt>Service</dt><dd>${money(order.serviceCharge ?? 0)}</dd></div>` : ""}<div><dt>Tax</dt><dd>${money(order.taxAmount ?? 0)}</dd></div><div class="grand"><dt>TOTAL</dt><dd>${money(order.total)}</dd></div></dl>${order.orderNote ? `<div class="order-note"><strong>ORDER NOTE</strong><br>${escapeHtml(order.orderNote)}</div>` : ""}<footer>Kitchen copy · ${escapeHtml(order.payment?.status ?? "UNPAID")} · Powered by TRONX</footer></section>`;
}

const PRINT_CSS = `
@page { margin: 3mm; size: 80mm auto; }
#tronx-kot-print-root { display: none; }
@media print {
 html,body{width:100%;min-height:0!important;margin:0!important;padding:0!important;background:#fff!important;overflow:visible!important}
 body>*:not(#tronx-kot-print-root){display:none!important}
 #tronx-kot-print-root{display:block!important;position:static!important;width:74mm!important;max-width:100%!important;margin:0 auto!important;color:#000!important;background:#fff!important;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace!important}
 .kot-ticket{width:100%;font-size:10.5pt;line-height:1.25;print-color-adjust:exact;-webkit-print-color-adjust:exact}.kot-ticket header{text-align:center}.kot-ticket .brand{font-size:9pt;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.kot-ticket .kind{margin-top:2mm;font-size:11pt;font-weight:900}.kot-ticket .order-number{margin-top:1mm;font-size:22pt;line-height:1;font-weight:900}.kot-ticket .location{margin-top:2mm;font-size:16pt;font-weight:900}.kot-ticket .meta{margin-top:1mm;font-size:8.5pt}.kot-ticket .rule{border-top:.35mm dashed #000;margin:2.5mm 0}.kot-ticket table{width:100%;border-collapse:collapse;table-layout:fixed}.kot-ticket th{padding:0 0 1.5mm;border-bottom:.25mm solid #000;font-size:8pt;text-align:left;text-transform:uppercase}.kot-ticket td{padding:2mm 0;vertical-align:top;border-bottom:.15mm dotted #777;break-inside:avoid}.kot-ticket .qty{width:10mm;font-size:15pt;font-weight:900}.kot-ticket .item{padding-right:1.5mm;overflow-wrap:anywhere}.kot-ticket .dish{font-size:11pt;font-weight:900}.kot-ticket .detail{margin-top:.7mm;font-size:8.5pt}.kot-ticket .note{margin-top:1mm;padding:1mm;border:.25mm solid #000;font-size:9pt;font-weight:900}.kot-ticket .cancelled{text-decoration:line-through;font-size:8pt}.kot-ticket .price{width:21mm;text-align:right;font-size:8.5pt;white-space:nowrap}.kot-ticket .price strong{display:block;margin-top:1mm;font-size:10pt}.kot-ticket .totals{margin:0}.kot-ticket .totals div{display:flex;justify-content:space-between;gap:3mm;margin:.8mm 0}.kot-ticket .totals dt,.kot-ticket .totals dd{margin:0}.kot-ticket .grand{margin-top:1.5mm!important;padding-top:1.5mm;border-top:.4mm solid #000;font-size:15pt;font-weight:900}.kot-ticket .order-note{margin-top:2.5mm;padding:2mm;border:.35mm solid #000;font-size:9pt}.kot-ticket footer{margin-top:3mm;text-align:center;font-size:8pt}
}`;

/** Uses the current page because mobile Safari/Chrome often block popup and iframe printing. */
export function printKitchenOrderTicket(order: OrderSummary, restaurantName?: string) {
  if (typeof window === "undefined") return;
  document.getElementById("tronx-kot-print-root")?.remove();
  document.getElementById("tronx-kot-print-style")?.remove();
  const style = document.createElement("style");
  style.id = "tronx-kot-print-style";
  style.textContent = PRINT_CSS;
  const root = document.createElement("div");
  root.id = "tronx-kot-print-root";
  root.innerHTML = buildKitchenOrderTicketHtml(order, restaurantName);
  document.head.appendChild(style);
  document.body.appendChild(root);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    window.removeEventListener("afterprint", cleanup);
    root.remove();
    style.remove();
  };
  window.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => window.print(), 120);
  window.setTimeout(cleanup, 60_000);
}

function pdfMoney(value: number) {
  return `Rs. ${Number(value || 0).toFixed(2)}`;
}

/** Downloads a durable digital KOT copy without requiring a configured printer. */
export function downloadKitchenOrderTicketPdf(order: OrderSummary, restaurantName = "TRONX") {
  if (typeof window === "undefined") return;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 16;
  const right = 194;
  let y = 18;
  const ensureSpace = (height: number) => {
    if (y + height <= 280) return;
    doc.addPage();
    y = 18;
  };
  const line = (label: string, value: string, bold = false) => {
    ensureSpace(8);
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(label, left, y);
    doc.text(value, right, y, { align: "right" });
    y += 7;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(restaurantName, 105, y, { align: "center" });
  y += 8;
  doc.setFontSize(12);
  doc.text("KITCHEN ORDER TICKET", 105, y, { align: "center" });
  y += 9;
  doc.setFontSize(20);
  doc.text(`ORDER #${order.orderNumber}`, 105, y, { align: "center" });
  y += 8;
  doc.setFontSize(12);
  doc.text(orderLocationName(order), 105, y, { align: "center" });
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`${formatOrderClock(order.createdAt)} | ${(order.source ?? order.channel ?? "ORDER").replace(/_/g, " ")}`, 105, y, { align: "center" });
  y += 7;
  doc.line(left, y, right, y);
  y += 7;

  doc.setFontSize(10);
  for (const item of order.items) {
    const quantity = Math.max(0, item.quantity - (item.cancelledQuantity ?? 0));
    const title = `${quantity} x ${item.dishNameSnapshot}`;
    const titleLines = doc.splitTextToSize(title, 125) as string[];
    ensureSpace(titleLines.length * 5 + 14);
    doc.setFont("helvetica", "bold");
    doc.text(titleLines, left, y);
    doc.text(pdfMoney(item.itemTotal), right, y, { align: "right" });
    y += titleLines.length * 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    const details = [
      item.variantNameSnapshot ? `Variant: ${item.variantNameSnapshot}` : "",
      ...item.addons.map((addon) => `+ ${addon.nameSnapshot}${addon.quantity > 1 ? ` x ${addon.quantity}` : ""}`),
      item.note ? `NOTE: ${item.note}` : "",
      item.cancelledQuantity ? `Cancelled quantity: ${item.cancelledQuantity}` : "",
    ].filter(Boolean);
    for (const detail of details) {
      const detailLines = doc.splitTextToSize(detail, 150) as string[];
      ensureSpace(detailLines.length * 4 + 2);
      doc.text(detailLines, left + 5, y);
      y += detailLines.length * 4;
    }
    y += 4;
    doc.setFontSize(10);
  }

  ensureSpace(48);
  doc.line(left, y, right, y);
  y += 7;
  line("Subtotal", pdfMoney(order.subtotal));
  if ((order.billDiscountAmount ?? 0) > 0) line("Discount", `- ${pdfMoney(order.billDiscountAmount ?? 0)}`);
  if ((order.packagingCharge ?? 0) > 0) line("Packaging", pdfMoney(order.packagingCharge ?? 0));
  if ((order.serviceCharge ?? 0) > 0) line("Service", pdfMoney(order.serviceCharge ?? 0));
  line("Tax", pdfMoney(order.taxAmount ?? 0));
  doc.setFontSize(13);
  line("TOTAL", pdfMoney(order.total), true);
  doc.setFontSize(9);
  if (order.orderNote) {
    ensureSpace(18);
    doc.setFont("helvetica", "bold");
    doc.text("ORDER NOTE", left, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(order.orderNote, right - left) as string[];
    doc.text(noteLines, left, y);
  }

  const safeRestaurant = restaurantName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "restaurant";
  doc.save(`${safeRestaurant}-kot-${order.orderNumber}.pdf`);
}
