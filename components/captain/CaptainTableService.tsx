"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Printer, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import UpiPaymentQr from "@/components/shared/UpiPaymentQr";
import type { DynamicPaymentRequest, MasterBill, OrderSummary, RestaurantTable, TableSession } from "@/types";
import { locationName } from "@/lib/service-location";
import { printQueuedKitchenOrderTicket, printSessionKitchenTicket } from "@/lib/kot-print";
import { buildUpiPaymentUri, isValidUpiId } from "@/lib/upi-payment";

const closedStatuses = new Set(["COMPLETED", "CANCELLED", "REJECTED", "REFUNDED"]);
const money = (value: number, currency: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function getTaxLines(orders: OrderSummary[], totalTax: number) {
  const lines = new Map<string, number>();
  for (const order of orders) {
    const taxAmount = order.taxAmount ?? 0;
    const rate = Math.max(0, order.taxRatePercent ?? 0);
    const splitRateLabel = rate ? ` (${(rate / 2).toFixed(2)}%)` : "";
    const parts: [string, number][] = [
      [`CGST${splitRateLabel}`, order.cgstAmount ?? 0],
      [`SGST${splitRateLabel}`, order.sgstAmount ?? 0],
      [`IGST${rate ? ` (${rate}%)` : ""}`, order.igstAmount ?? 0],
    ];
    for (const [label, amount] of parts) if (amount > 0.005) lines.set(label, (lines.get(label) ?? 0) + amount);
    const splitTax = (order.cgstAmount ?? 0) + (order.sgstAmount ?? 0) + (order.igstAmount ?? 0);
    if (taxAmount - splitTax > 0.005) {
      const label = rate ? `GST / tax (${rate}%)` : "GST / tax";
      lines.set(label, (lines.get(label) ?? 0) + taxAmount - splitTax);
    }
  }
  const orderTax = orders.reduce((sum, order) => sum + (order.taxAmount ?? 0), 0);
  const unallocatedTax = Math.max(0, totalTax - orderTax);
  if (unallocatedTax > 0.005) lines.set("Other tax", (lines.get("Other tax") ?? 0) + unallocatedTax);
  if (!lines.size && totalTax > 0.005) lines.set("GST / tax", totalTax);
  return [...lines].map(([label, amount]) => ({ label, amount }));
}

async function printBill(bill: MasterBill, orders: OrderSummary[], restaurantName: string, tableName: string, currency: string, upiSettings: { enabled: boolean; upiId: string; payeeName: string; staticQrUrl?: string }) {
  const root = document.createElement("section");
  root.id = "captain-bill-print";
  const style = document.createElement("style");
  style.textContent = `#captain-bill-print{display:none}@page{size:80mm auto;margin:4mm}@media print{body>*:not(#captain-bill-print){display:none!important}#captain-bill-print{display:block!important;font:11pt/1.4 monospace;color:#000;width:72mm}#captain-bill-print h1,#captain-bill-print h2{text-align:center;margin:0}#captain-bill-print h1{font-size:16pt}#captain-bill-print h2{font-size:12pt}#captain-bill-print table{width:100%;border-collapse:collapse;margin:6mm 0}#captain-bill-print td{padding:1mm 0;vertical-align:top}#captain-bill-print td:last-child{text-align:right;white-space:nowrap}#captain-bill-print .total{font-size:15pt;font-weight:bold;border-top:1px dashed #000;padding-top:2mm}#captain-bill-print .payment{text-align:center;border-top:1px dashed #000;padding-top:4mm}#captain-bill-print .payment img{display:block;width:42mm;height:42mm;object-fit:contain;margin:3mm auto}}`;
  const row = (name: string, value: number) => `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(money(value, currency))}</td></tr>`;
  const billOrders = orders.filter((order) => bill.orderIds.includes(order.id));
  const taxRows = getTaxLines(billOrders, bill.taxAmount).map(({ label, amount }) => row(label, amount)).join("");
  let paymentQrUrl = "";
  const canShowPaymentQr = upiSettings.enabled && bill.outstandingAmount > 0 && (isValidUpiId(upiSettings.upiId) || upiSettings.staticQrUrl);
  if (canShowPaymentQr && isValidUpiId(upiSettings.upiId)) {
    paymentQrUrl = await QRCode.toDataURL(buildUpiPaymentUri({ upiId: upiSettings.upiId, payeeName: upiSettings.payeeName, amount: bill.outstandingAmount, orderNumber: bill.billNumber }), { width: 420, margin: 2, errorCorrectionLevel: "M" });
  } else if (canShowPaymentQr && upiSettings.staticQrUrl) {
    paymentQrUrl = new URL(upiSettings.staticQrUrl, window.location.origin).toString();
  }
  const paymentHtml = paymentQrUrl ? `<div class="payment"><strong>SCAN TO PAY ${escapeHtml(money(bill.outstandingAmount, currency))}</strong><img src="${escapeHtml(paymentQrUrl)}" alt="Restaurant payment QR"><small>${isValidUpiId(upiSettings.upiId) ? `Bill ${escapeHtml(bill.billNumber)} · ${escapeHtml(upiSettings.payeeName)}` : "Static merchant QR · confirm the amount in your UPI app"}</small></div>` : "";
  root.innerHTML = `<h1>${escapeHtml(restaurantName)}</h1><h2>${escapeHtml(tableName)} · ${escapeHtml(bill.billNumber)}</h2><table>${bill.lines.map((line) => row(`#${line.orderNumber} · ${line.billableQuantity}× ${line.dishNameSnapshot} · ${money(line.lineTotal / Math.max(1, line.billableQuantity), currency)} each`, line.lineTotal)).join("")}${row("Subtotal", bill.subtotal)}${bill.discountAmount ? row("Discount", -bill.discountAmount) : ""}${bill.packagingCharge ? row("Packaging", bill.packagingCharge) : ""}${bill.serviceCharge ? row("Service charge", bill.serviceCharge) : ""}${bill.tipAmount ? row("Service tax", bill.tipAmount) : ""}${bill.tipAmount ? `<tr><td colspan="2" style="text-align:center;font-size:11px">Service tax is voluntary.</td></tr>` : ""}${taxRows}<tr class="total"><td>Total</td><td>${escapeHtml(money(bill.total, currency))}</td></tr>${row("Paid", bill.amountPaid)}${row("Due", bill.outstandingAmount)}</table>${paymentHtml}<p style="text-align:center">Thank you for dining with us.</p>`;
  document.head.appendChild(style);
  document.body.appendChild(root);
  const paymentImage = root.querySelector<HTMLImageElement>(".payment img");
  if (paymentImage && !paymentImage.complete) {
    await new Promise<void>((resolve) => {
      const timeout = window.setTimeout(resolve, 1500);
      paymentImage.addEventListener("load", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
      paymentImage.addEventListener("error", () => { window.clearTimeout(timeout); resolve(); }, { once: true });
    });
  }
  const cleanup = () => { root.remove(); style.remove(); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => window.print(), 120);
  window.setTimeout(cleanup, 60_000);
}

export default function CaptainTableService({ slug, restaurantName, table, currency, upiSettings, initialOrders, initialSession, initialBill }: {
  slug: string;
  restaurantName: string;
  table: RestaurantTable;
  currency: string;
  upiSettings: { enabled: boolean; upiId: string; payeeName: string; staticQrUrl?: string };
  initialOrders: OrderSummary[];
  initialSession: TableSession | null;
  initialBill: MasterBill | null;
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [session, setSession] = useState(initialSession);
  const [bill, setBill] = useState(initialBill);
  const [tip, setTip] = useState(String(initialBill?.tipAmount ?? 0));
  const [method, setMethod] = useState<"CASH" | "CARD">("CASH");
  const [upi, setUpi] = useState<DynamicPaymentRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const url = `/api/captain/tables/${encodeURIComponent(table.id)}`;
  // An open visit remains billable even if a kitchen workflow marked an individual
  // ticket completed. Historical completed orders without a visit stay archived.
  const activeOrders = session
    ? orders.filter((order) => (order.tableSessionId === session.id || (!order.tableSessionId && !closedStatuses.has(order.status))) && !["CANCELLED", "REJECTED", "REFUNDED"].includes(order.status))
    : orders.filter((order) => !closedStatuses.has(order.status));
  const orderTotal = activeOrders.reduce((sum, order) => sum + order.total, 0);
  const billTaxLines = getTaxLines(bill ? orders.filter((order) => bill.orderIds.includes(order.id)) : activeOrders, bill?.taxAmount ?? activeOrders.reduce((sum, order) => sum + (order.taxAmount ?? 0), 0));
  const unsentOrders = activeOrders.filter((order) => order.status === "PENDING" || order.items.some((item) => item.lineId && !(order.kotLineIds ?? []).includes(item.lineId) && ((order.kotLineIds ?? []).length > 0 || order.status === "ACCEPTED")));
  const billNeedsUpdate = Boolean(bill && (Math.abs(bill.total - bill.tipAmount - orderTotal) >= 0.01 || Math.abs(bill.tipAmount - (Number(tip) || 0)) >= 0.01));
  const upiOrder = activeOrders.length === 1 && bill && !billNeedsUpdate && bill.tipAmount === 0 && Math.abs(bill.outstandingAmount - (activeOrders[0].total - (activeOrders[0].payment?.amountPaid ?? 0))) < 0.01 ? activeOrders[0] : null;

  const refresh = useCallback(async () => {
    const response = await fetch(url, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "Unable to refresh table.");
    setOrders(json.data.orders ?? []);
    setSession(json.data.session ?? null);
    setBill(json.data.bill ?? null);
    return json.data as { orders: OrderSummary[]; session: TableSession | null; bill: MasterBill | null };
  }, [url]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Action failed. Please retry."); }
    finally { setBusy(false); }
  }

  async function postSession(body: Record<string, unknown>) {
    const response = await fetch(`${url}/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "Unable to update bill.");
    return json.data;
  }

  async function dispatchUnsentOrders() {
    const batch: OrderSummary[] = [];
    for (const order of unsentOrders) {
        const response = await fetch(`/api/captain/orders/${encodeURIComponent(order.id)}/send-kot`, { method: "POST" });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || `Could not send order #${order.orderNumber}.`);
        batch.push({ ...json.data, items: json.data.items.filter((item: OrderSummary["items"][number]) => item.lineId && !(order.kotLineIds ?? []).includes(item.lineId)) });
    }
    return batch;
  }

  function sendKot() {
    void run(async () => {
      const batch = await dispatchUnsentOrders();
      if (batch.length === 1) printQueuedKitchenOrderTicket(batch[0], restaurantName, []);
      else if (batch.length > 1) printSessionKitchenTicket(batch, restaurantName, locationName(table));
      await refresh();
      setMessage("New items sent to kitchen. KOT ready to print.");
    });
  }

  function showBill() {
    void run(async () => {
      if (activeOrders.some((order) => order.status === "PENDING")) {
        throw new Error("Approve the customer’s pending order first, then show the final bill.");
      }
      const currentSession = session ?? (await refresh()).session;
      if (!currentSession) throw new Error("No active table visit was found. Refresh the table and try again.");
      const updated = await postSession({ action: "GENERATE_BILL", sessionId: currentSession.id, tipAmount: Number(tip) || 0, revise: Boolean(bill) });
      setBill(updated);
      await refresh();
      setMessage("Bill ready to show the guest.");
    });
  }

  function recordPayment() {
    if (!bill || billNeedsUpdate || unsentOrders.length) return;
    const amount = bill.outstandingAmount;
    if (!window.confirm(`Confirm ${money(amount, currency)} received by ${method}?`)) return;
    void run(async () => {
      await postSession({ action: "RECORD_PAYMENT", billId: bill.id, amount, method, idempotencyKey: crypto.randomUUID() });
      await refresh();
      setMessage("Payment recorded. You can finish the table now.");
    });
  }

  function createUpi() {
    if (!upiOrder) return;
    void run(async () => {
      const response = await fetch(`/api/captain/orders/${encodeURIComponent(upiOrder.id)}/upi`, { method: "POST" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "UPI QR unavailable. Ask the owner to configure the payment provider.");
      setUpi(json.data);
      setMessage("Waiting for verified UPI payment.");
    });
  }

  const refreshUpi = useCallback(async (orderId: string, currentSession: TableSession) => {
    const response = await fetch(`/api/captain/orders/${encodeURIComponent(orderId)}/upi/status`, { cache: "no-store" });
    const json = await response.json();
    if (!response.ok || !json.success) throw new Error(json.error || "Unable to refresh payment.");
    setUpi(json.data);
    if (json.data.status === "PAID") {
      await postSession({ action: "GENERATE_BILL", sessionId: currentSession.id, tipAmount: 0, revise: true });
      await refresh();
      setMessage("UPI payment verified. You can finish the table now.");
    }
  }, [refresh, url]);

  useEffect(() => {
    if (!upi || !session || !upiOrder || upi.status !== "PENDING") return;
    const timer = window.setInterval(() => { void refreshUpi(upiOrder.id, session).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to refresh payment.")); }, 5000);
    return () => window.clearInterval(timer);
  }, [upi, session, upiOrder, refreshUpi]);

  function endTableVisit() {
    if (activeOrders.some((order) => order.status === "PENDING")) {
      setMessage("Approve the customer’s pending order first. Then end the table visit.");
      return;
    }
    void run(async () => {
      const currentSession = session ?? (await refresh()).session;
      if (!currentSession) throw new Error("No active table visit was found. Refresh the table and try again.");
      let finalBill = bill;
      if (!finalBill || billNeedsUpdate) {
        finalBill = await postSession({ action: "GENERATE_BILL", sessionId: currentSession.id, tipAmount: Number(tip) || 0, revise: Boolean(finalBill) });
        setBill(finalBill);
      }
      if (!finalBill) throw new Error("The final bill could not be created.");
      if (finalBill.outstandingAmount > 0) {
        if (unsentOrders.length) {
          const sendConfirmation = window.confirm(`The customer has ${money(finalBill.outstandingAmount, currency)} due. Send the final waiting items to Kitchen now? Record payment before completing and freeing the table.`);
          if (!sendConfirmation) return;
          const batch = await dispatchUnsentOrders();
          if (batch.length === 1) printQueuedKitchenOrderTicket(batch[0], restaurantName, []);
          else if (batch.length > 1) printSessionKitchenTicket(batch, restaurantName, locationName(table));
          await new Promise((resolve) => window.setTimeout(resolve, 180));
          await refresh();
        }
        setMessage(`Bill ${finalBill.billNumber} has ${money(finalBill.outstandingAmount, currency)} due. Record the payment before marking this order completed and freeing the table.`);
        return;
      }
      const confirmation = `The bill is paid. End ${locationName(table)}'s visit and make the table available for the next guests?`;
      if (!window.confirm(confirmation)) return;
      if (unsentOrders.length) {
        const batch = await dispatchUnsentOrders();
        if (batch.length === 1) printQueuedKitchenOrderTicket(batch[0], restaurantName, []);
        else if (batch.length > 1) printSessionKitchenTicket(batch, restaurantName, locationName(table));
        // Let the browser's print dialog start before navigating away from this table.
        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }
      await postSession({ action: "CLOSE_SESSION", sessionId: currentSession.id });
      router.push(`/captain/${slug}/tables`);
      router.refresh();
    });
  }

  return <div className="mx-auto max-w-4xl space-y-5 pb-24">
    <Link href={`/captain/${slug}/tables`} className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-500"><ArrowLeft className="h-4 w-4" /> All tables</Link>
    <header className="rounded-3xl bg-neutral-900 p-5 text-white sm:p-7"><p className="text-xs font-semibold uppercase tracking-widest text-white/50">{table.label || "Dining area"}</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">{locationName(table)}</h1><p className="mt-2 text-sm text-white/70">{session ? `${activeOrders.length} order${activeOrders.length === 1 ? "" : "s"} · ${money(orderTotal, currency)} so far` : activeOrders.length ? `${activeOrders.length} order${activeOrders.length === 1 ? "" : "s"} · ${money(orderTotal, currency)} so far` : "Ready for a new order"}</p></header>
    {message ? <p role="status" className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold">{message}</p> : null}
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Table order</h2><p className="text-sm text-neutral-500">Add more items whenever the guest asks.</p></div><Link href={`/captain/${slug}/take-order?table=${encodeURIComponent(table.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" /> {activeOrders.length ? "Add items" : "Take order"}</Link></div>
      {activeOrders.length ? <div className="mt-5 space-y-3">{activeOrders.map((order) => <div key={order.id} className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4"><div className="mb-2 flex justify-between gap-2 text-xs font-semibold text-neutral-500"><span>Order #{order.orderNumber}</span><span>{order.status === "PREPARING" ? "Cooking" : order.status === "READY" ? "Ready" : order.status === "SERVED" ? "Served" : order.status === "PENDING" ? "New" : order.kotLineIds?.length ? "Sent to kitchen" : "KOT waiting"}</span></div>{order.items.filter((item) => item.quantity > (item.cancelledQuantity ?? 0)).map((item, index) => <div key={item.lineId ?? index} className="flex justify-between gap-3 border-t border-neutral-200 py-2 text-sm"><span>{item.quantity - (item.cancelledQuantity ?? 0)}× {item.dishNameSnapshot}{item.note ? <small className="block text-neutral-500">{item.note}</small> : null}</span><strong>{money(item.itemTotal, currency)}</strong></div>)}</div>)}</div> : <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">No items yet. Tap Take order to start.</p>}
      {activeOrders.length ? <div className="mt-4 flex flex-wrap gap-2">{unsentOrders.length ? <button type="button" disabled={busy} onClick={sendKot} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-neutral-950 disabled:opacity-50"><Printer className="h-4 w-4" /> Send order to kitchen &amp; print KOT</button> : null}<button type="button" disabled={busy} onClick={() => printSessionKitchenTicket(activeOrders.map((order) => ({ ...order, items: order.items.filter((item) => item.lineId && (order.kotLineIds ?? []).includes(item.lineId)) })).filter((order) => order.items.length), restaurantName, locationName(table))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-300 px-4 text-sm font-semibold disabled:opacity-50"><Printer className="h-4 w-4" /> Print KOT copy</button><button type="button" disabled={busy} onClick={() => void run(async () => { await refresh(); setMessage("Table updated."); })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-300 px-4 text-sm font-semibold disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh</button><p className="w-full text-xs text-neutral-500">Sending creates the Kitchen “New” ticket and keeps this order in Orders and today’s reports.</p></div> : null}
    </section>
    {session || activeOrders.length ? <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Customer bill</h2><p className="text-sm text-neutral-500">Item price, quantity, service charge and each GST amount before payment.</p></div><button type="button" disabled={busy || !activeOrders.length || activeOrders.some((order) => order.status === "PENDING")} onClick={showBill} className="min-h-11 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white disabled:opacity-40">{bill ? "Update bill" : "Show bill"}</button></div>{activeOrders.some((order) => order.status === "PENDING") ? <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Approve pending customer orders before preparing the final bill.</p> : null}
      {(!bill || bill.amountPaid === 0) ? <div className="mt-4"><p className="text-sm font-semibold">Service tax (optional)</p><p className="text-xs text-neutral-500">The guest can say no. Pick a percent or type a rupee amount.</p><div className="mt-2 flex flex-wrap gap-2">{[0, 5, 10, 15, 20].map((percent) => <button key={percent} type="button" onClick={() => setTip((Math.round(orderTotal * percent) / 100).toFixed(2))} className="min-h-12 min-w-14 rounded-xl bg-neutral-900 px-3 text-sm font-black text-white">{percent}%</button>)}</div><label className="mt-3 block text-sm font-semibold">Amount in ₹ <input type="number" min="0" step="0.01" value={tip} onChange={(event) => setTip(event.target.value)} className="mt-1 block h-12 w-40 rounded-xl border border-neutral-300 px-3 text-lg" /></label></div> : null}
      {!bill ? <div className="mt-4 space-y-3"><div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 p-4">{activeOrders.flatMap((order) => order.items.filter((item) => item.quantity > (item.cancelledQuantity ?? 0)).map((item, index) => <div key={`${order.id}-${item.lineId ?? index}`} className="flex justify-between gap-3 py-2 text-sm"><span><span className="font-semibold">#{order.orderNumber} · {item.quantity - (item.cancelledQuantity ?? 0)}× {item.dishNameSnapshot}</span><small className="block text-neutral-500">{money(item.itemTotal / Math.max(1, item.quantity), currency)} each</small></span><span className="font-semibold">{money(item.itemTotal * (item.quantity - (item.cancelledQuantity ?? 0)) / Math.max(1, item.quantity), currency)}</span></div>))}</div><dl className="space-y-2 text-sm">{[["Items subtotal", activeOrders.reduce((sum, order) => sum + order.subtotal, 0)], ["Discount", -activeOrders.reduce((sum, order) => sum + (order.billDiscountAmount ?? 0), 0)], ["Packaging", activeOrders.reduce((sum, order) => sum + (order.packagingCharge ?? 0), 0)], ["Service charge", activeOrders.reduce((sum, order) => sum + (order.serviceCharge ?? 0), 0)], ["Tip", Number(tip) || 0], ...billTaxLines.map(({ label, amount }) => [label, amount] as [string, number])].filter(([label, value]) => Number(value) > 0.01 || (label === "Discount" && Number(value) < -0.01)).map(([label, value]) => <div key={label} className="flex justify-between"><dt>{label}</dt><dd>{money(Number(value), currency)}</dd></div>)}<div className="flex justify-between border-t border-neutral-200 pt-3 text-lg font-black"><dt>Estimated total</dt><dd>{money(orderTotal + (Number(tip) || 0), currency)}</dd></div><p className="text-xs text-neutral-500">This itemized estimate uses the saved order prices. Tap Show bill to save the final bill.</p></dl></div> : <div className="mt-5 space-y-3"><div className="flex items-center justify-between"><strong>Bill {bill.billNumber}</strong><button type="button" onClick={() => void printBill(bill, orders, restaurantName, locationName(table), currency, upiSettings).catch((error) => setMessage(error instanceof Error ? error.message : "Unable to print bill."))} className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold"><Printer className="h-4 w-4" /> Print customer bill</button></div><div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 p-4">{bill.lines.map((line) => { const unitPrice = line.lineTotal / Math.max(1, line.billableQuantity); const orderNumber = orders.find((order) => order.id === line.orderId)?.orderNumber ?? line.orderNumber; return <div key={line.allocationKey} className="flex justify-between gap-3 py-2 text-sm"><span><span className="font-semibold">#{orderNumber} · {line.billableQuantity}× {line.dishNameSnapshot}</span><small className="block text-neutral-500">{money(unitPrice, currency)} each</small></span><span>{money(line.lineTotal, currency)}</span></div>; })}</div><dl className="space-y-2 text-sm">{[["Subtotal", bill.subtotal], ["Discount", -bill.discountAmount], ["Packaging", bill.packagingCharge], ["Service charge", bill.serviceCharge], ["Tip", bill.tipAmount], ...billTaxLines.map(({ label, amount }) => [label, amount] as [string, number])].filter(([label, value]) => Number(value) > 0.01 || (label === "Discount" && Number(value) < -0.01)).map(([label, value]) => <div key={label} className="flex justify-between"><dt>{label}</dt><dd>{money(Number(value), currency)}</dd></div>)}<div className="flex justify-between border-t border-neutral-200 pt-3 text-lg font-black"><dt>Total</dt><dd>{money(bill.total, currency)}</dd></div><div className="flex justify-between font-bold"><dt>Remaining</dt><dd>{money(bill.outstandingAmount, currency)}</dd></div></dl>
        {bill.outstandingAmount > 0 && upiSettings.enabled && (isValidUpiId(upiSettings.upiId) || upiSettings.staticQrUrl) ? <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3"><h3 className="mb-3 text-sm font-bold">Customer payment QR</h3><UpiPaymentQr upiId={upiSettings.upiId} payeeName={upiSettings.payeeName} staticQrUrl={upiSettings.staticQrUrl} amount={bill.outstandingAmount} orderNumber={bill.billNumber} compact /></div> : null}
        {billNeedsUpdate ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">The table order changed. Tap Update bill before taking payment.</p> : bill.outstandingAmount > 0 ? <div className="space-y-3 border-t border-neutral-200 pt-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setMethod("CASH")} className={`rounded-xl px-4 py-2 text-sm font-bold ${method === "CASH" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>Cash</button><button type="button" onClick={() => setMethod("CARD")} className={`rounded-xl px-4 py-2 text-sm font-bold ${method === "CARD" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>Card</button><button type="button" disabled={busy || !upiOrder} onClick={createUpi} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold disabled:opacity-40">UPI QR</button></div><button type="button" disabled={busy || unsentOrders.length > 0} onClick={recordPayment} className="min-h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">Record {method} received · {money(bill.outstandingAmount, currency)}</button>{!upiOrder ? <p className="text-xs text-neutral-500">A verified UPI QR is available when this bill matches one unpaid order without an extra tip. Cash or card can settle a consolidated bill.</p> : null}{upi ? <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center"><p className="font-bold">{restaurantName} · {locationName(table)} · {money(upi.amount, currency)}</p>{upi.qrImageUrl ? <Image unoptimized src={upi.qrImageUrl} alt={`UPI payment QR for bill ${bill.billNumber}`} width={280} height={280} className="mx-auto mt-3 h-70 w-70 max-w-full object-contain" /> : null}<p className="mt-2 text-sm">{upi.status === "PAID" ? "Payment verified" : upi.status === "PENDING" ? "Waiting for verified payment…" : `Payment ${upi.status.toLowerCase()}`}</p><button type="button" onClick={() => upiOrder && session && void run(() => refreshUpi(upiOrder.id, session))} className="mt-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold">Refresh status</button></div> : null}</div> : <p className="border-t border-neutral-200 pt-4 font-semibold text-emerald-700">Bill paid in full.</p>}
      </div>}
    </section> : null}
    {session || activeOrders.length ? <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"><h2 className="text-lg font-bold">End table visit</h2><p className="mt-1 text-sm text-neutral-600">{bill ? bill.outstandingAmount > 0 ? `${money(bill.outstandingAmount, currency)} is still due. Record the received payment before the order can be marked completed and the table freed.` : "The bill is paid. End the visit to make this table available for the next guests." : "After the guest confirms they are finished, finalize the bill and payment to free the table."}</p><button type="button" disabled={busy} onClick={endTableVisit} className="mt-4 min-h-12 w-full rounded-xl bg-neutral-900 px-4 text-base font-bold text-white disabled:opacity-40">{busy ? "Finishing table…" : "Finish visit & free table"}</button>{unsentOrders.length ? <p className="mt-2 text-xs font-medium text-neutral-500">Any accepted items not yet sent will be sent to Kitchen before this visit closes.</p> : null}</section> : null}
  </div>;
}
