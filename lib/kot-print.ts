import type { OrderSummary } from "@/types";
import { formatOrderClock } from "@/lib/order-board";

/** Opens a print-ready Kitchen Order Ticket for the given order. */
export function printKitchenOrderTicket(order: OrderSummary, restaurantName?: string) {
  if (typeof window === "undefined") return;

  const itemsHtml = order.items
    .map((item) => {
      const addons = item.addons
        .map((addon) => `<div class="addon">+ ${escapeHtml(addon.nameSnapshot)}${addon.quantity > 1 ? ` × ${addon.quantity}` : ""}</div>`)
        .join("");
      return `<tr>
        <td class="qty">${item.quantity}</td>
        <td>
          <div class="dish">${escapeHtml(item.dishNameSnapshot)}</div>
          ${addons}
        </td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>KOT #${order.orderNumber}</title>
  <style>
    @page { margin: 8mm; size: 80mm auto; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; color: #111; }
    .ticket { width: 72mm; max-width: 100%; margin: 0 auto; }
    .brand { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; text-align: center; }
    .title { margin: 6px 0 2px; font-size: 22px; font-weight: 900; text-align: center; }
    .meta { text-align: center; font-size: 12px; margin-bottom: 10px; }
    .rule { border-top: 1px dashed #111; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 4px 0; font-size: 13px; }
    .qty { width: 18px; font-weight: 900; }
    .dish { font-weight: 800; font-size: 14px; }
    .addon { font-size: 11px; margin-top: 2px; }
    .foot { margin-top: 10px; text-align: center; font-size: 11px; }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="brand">${escapeHtml(restaurantName || "TRONX")}</div>
    <div class="title">KOT #${escapeHtml(String(order.orderNumber))}</div>
    <div class="meta">Table ${escapeHtml(String(order.tableNumber))} · ${escapeHtml(formatOrderClock(order.createdAt))}</div>
    <div class="rule"></div>
    <table>${itemsHtml}</table>
    <div class="rule"></div>
    <div class="foot">Kitchen copy · Powered by TRONX</div>
  </div>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
      setTimeout(function () { window.close(); }, 400);
    };
  </script>
</body>
</html>`;

  const popup = window.open("", "_blank", "noopener,noreferrer,width=420,height=640");
  if (!popup) {
    // Popup blocked — fall back to an iframe print so Accept still works.
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc) {
      document.body.removeChild(frame);
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => document.body.removeChild(frame), 1000);
    };
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
