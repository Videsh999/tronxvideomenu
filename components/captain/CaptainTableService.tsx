"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Printer, RefreshCw } from "lucide-react";
import type { DynamicPaymentRequest, MasterBill, OrderSummary, RestaurantTable, TableSession } from "@/types";
import { locationName } from "@/lib/service-location";
import { printQueuedKitchenOrderTicket, printSessionKitchenTicket } from "@/lib/kot-print";

const closedStatuses = new Set(["CANCELLED", "REJECTED", "REFUNDED"]);
const money = (value: number, currency: string) => new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function printBill(bill: MasterBill, orders: OrderSummary[], restaurantName: string, tableName: string, currency: string) {
  const root = document.createElement("section");
  root.id = "captain-bill-print";
  const style = document.createElement("style");
  style.textContent = `#captain-bill-print{display:none}@page{size:80mm auto;margin:4mm}@media print{body>*:not(#captain-bill-print){display:none!important}#captain-bill-print{display:block!important;font:11pt/1.4 monospace;color:#000;width:72mm}#captain-bill-print h1,#captain-bill-print h2{text-align:center;margin:0}#captain-bill-print h1{font-size:16pt}#captain-bill-print h2{font-size:12pt}#captain-bill-print table{width:100%;border-collapse:collapse;margin:6mm 0}#captain-bill-print td{padding:1mm 0;vertical-align:top}#captain-bill-print td:last-child{text-align:right;white-space:nowrap}#captain-bill-print .total{font-size:15pt;font-weight:bold;border-top:1px dashed #000;padding-top:2mm}}`;
  const row = (name: string, value: number) => `<tr><td>${escapeHtml(name)}</td><td>${escapeHtml(money(value, currency))}</td></tr>`;
  const billOrders = orders.filter((order) => bill.orderIds.includes(order.id));
  const cgst = billOrders.reduce((sum, order) => sum + (order.cgstAmount ?? 0), 0);
  const sgst = billOrders.reduce((sum, order) => sum + (order.sgstAmount ?? 0), 0);
  const igst = billOrders.reduce((sum, order) => sum + (order.igstAmount ?? 0), 0);
  const otherTax = Math.max(0, bill.taxAmount - cgst - sgst - igst);
  const taxRows = cgst || sgst || igst ? `${cgst ? row("CGST", cgst) : ""}${sgst ? row("SGST", sgst) : ""}${igst ? row("IGST", igst) : ""}${otherTax > 0.01 ? row("Other tax", otherTax) : ""}` : row("GST / tax", bill.taxAmount);
  root.innerHTML = `<h1>${escapeHtml(restaurantName)}</h1><h2>${escapeHtml(tableName)} · ${escapeHtml(bill.billNumber)}</h2><table>${bill.lines.map((line) => row(`${line.billableQuantity}× ${line.dishNameSnapshot}`, line.lineTotal)).join("")}${row("Subtotal", bill.subtotal)}${bill.discountAmount ? row("Discount", -bill.discountAmount) : ""}${bill.serviceCharge ? row("Service charge", bill.serviceCharge) : ""}${bill.tipAmount ? row("Tip", bill.tipAmount) : ""}${taxRows}<tr class="total"><td>Total</td><td>${escapeHtml(money(bill.total, currency))}</td></tr>${row("Paid", bill.amountPaid)}${row("Due", bill.outstandingAmount)}</table><p>Thank you for dining with us.</p>`;
  document.head.appendChild(style);
  document.body.appendChild(root);
  const cleanup = () => { root.remove(); style.remove(); window.removeEventListener("afterprint", cleanup); };
  window.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => window.print(), 120);
  window.setTimeout(cleanup, 60_000);
}

export default function CaptainTableService({ slug, restaurantName, table, currency, initialOrders, initialSession, initialBill }: {
  slug: string;
  restaurantName: string;
  table: RestaurantTable;
  currency: string;
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
  const activeOrders = orders.filter((order) => !closedStatuses.has(order.status));
  const orderTotal = activeOrders.reduce((sum, order) => sum + order.total, 0);
  const cgst = activeOrders.reduce((sum, order) => sum + (order.cgstAmount ?? 0), 0);
  const sgst = activeOrders.reduce((sum, order) => sum + (order.sgstAmount ?? 0), 0);
  const igst = activeOrders.reduce((sum, order) => sum + (order.igstAmount ?? 0), 0);
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

  function sendKot() {
    void run(async () => {
      const batch: OrderSummary[] = [];
      for (const order of unsentOrders) {
        const response = await fetch(`/api/captain/orders/${encodeURIComponent(order.id)}/send-kot`, { method: "POST" });
        const json = await response.json();
        if (!response.ok || !json.success) throw new Error(json.error || `Could not send order #${order.orderNumber}.`);
        batch.push({ ...json.data, items: json.data.items.filter((item: OrderSummary["items"][number]) => item.lineId && !(order.kotLineIds ?? []).includes(item.lineId)) });
      }
      if (batch.length === 1) printQueuedKitchenOrderTicket(batch[0], restaurantName, []);
      else if (batch.length > 1) printSessionKitchenTicket(batch, restaurantName, locationName(table));
      await refresh();
      setMessage("New items sent to kitchen. KOT ready to print.");
    });
  }

  function showBill() {
    if (!session) return;
    void run(async () => {
      const updated = await postSession({ action: "GENERATE_BILL", sessionId: session.id, tipAmount: Number(tip) || 0, revise: Boolean(bill) });
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

  function finishTable() {
    if (!session || bill?.status !== "PAID" || billNeedsUpdate || unsentOrders.length) return;
    void run(async () => {
      await postSession({ action: "CLOSE_SESSION", sessionId: session.id });
      router.push(`/captain/${slug}/tables`);
      router.refresh();
    });
  }

  return <div className="mx-auto max-w-4xl space-y-5 pb-24">
    <Link href={`/captain/${slug}/tables`} className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-500"><ArrowLeft className="h-4 w-4" /> All tables</Link>
    <header className="rounded-3xl bg-neutral-900 p-5 text-white sm:p-7"><p className="text-xs font-semibold uppercase tracking-widest text-white/50">{table.label || "Dining area"}</p><h1 className="mt-1 text-3xl font-black sm:text-4xl">{locationName(table)}</h1><p className="mt-2 text-sm text-white/70">{activeOrders.length ? `${activeOrders.length} order${activeOrders.length === 1 ? "" : "s"} · ${money(orderTotal, currency)} so far` : "Ready for a new order"}</p></header>
    {message ? <p role="status" className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-semibold">{message}</p> : null}
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Table order</h2><p className="text-sm text-neutral-500">Add more items whenever the guest asks.</p></div><Link href={`/captain/${slug}/take-order?table=${encodeURIComponent(table.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" /> {activeOrders.length ? "Add items" : "Take order"}</Link></div>
      {activeOrders.length ? <div className="mt-5 space-y-3">{activeOrders.map((order) => <div key={order.id} className="rounded-2xl border border-neutral-100 bg-neutral-50 p-4"><div className="mb-2 flex justify-between gap-2 text-xs font-semibold text-neutral-500"><span>Order #{order.orderNumber}</span><span>{order.status === "PREPARING" ? "Cooking" : order.status === "READY" ? "Ready" : order.status === "SERVED" ? "Served" : order.status === "PENDING" ? "New" : order.kotLineIds?.length ? "Sent to kitchen" : "KOT waiting"}</span></div>{order.items.filter((item) => item.quantity > (item.cancelledQuantity ?? 0)).map((item, index) => <div key={item.lineId ?? index} className="flex justify-between gap-3 border-t border-neutral-200 py-2 text-sm"><span>{item.quantity - (item.cancelledQuantity ?? 0)}× {item.dishNameSnapshot}{item.note ? <small className="block text-neutral-500">{item.note}</small> : null}</span><strong>{money(item.itemTotal, currency)}</strong></div>)}</div>)}</div> : <p className="mt-5 rounded-2xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">No items yet. Tap Take order to start.</p>}
      {activeOrders.length ? <div className="mt-4 flex flex-wrap gap-2">{unsentOrders.length ? <button type="button" disabled={busy} onClick={sendKot} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-neutral-950 disabled:opacity-50"><Printer className="h-4 w-4" /> Send &amp; print new KOT</button> : null}<button type="button" disabled={busy} onClick={() => printSessionKitchenTicket(activeOrders.map((order) => ({ ...order, items: order.items.filter((item) => item.lineId && (order.kotLineIds ?? []).includes(item.lineId)) })).filter((order) => order.items.length), restaurantName, locationName(table))} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-300 px-4 text-sm font-semibold disabled:opacity-50"><Printer className="h-4 w-4" /> Print KOT copy</button><button type="button" disabled={busy} onClick={() => void run(async () => { await refresh(); setMessage("Table updated."); })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-neutral-300 px-4 text-sm font-semibold disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh</button></div> : null}
    </section>
    {activeOrders.length ? <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Bill &amp; payment</h2><p className="text-sm text-neutral-500">Show the complete table bill when the guest is ready.</p></div><button type="button" disabled={busy || !session || unsentOrders.length > 0} onClick={showBill} className="min-h-11 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white disabled:opacity-40">{bill ? "Update bill" : "Show bill"}</button></div>
      {(!bill || bill.amountPaid === 0) ? <label className="mt-4 block text-sm font-semibold">Optional service charge / tip <input type="number" min="0" step="0.01" value={tip} onChange={(event) => setTip(event.target.value)} className="mt-1 block h-11 w-40 rounded-xl border border-neutral-300 px-3" /></label> : null}
      {!bill ? <p className="mt-2 text-sm text-neutral-500">Current order total: {money(orderTotal, currency)}. Final taxes and charges appear on the bill.</p> : <div className="mt-5 space-y-3"><div className="flex items-center justify-between"><strong>Bill {bill.billNumber}</strong><button type="button" onClick={() => printBill(bill, orders, restaurantName, locationName(table), currency)} className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold"><Printer className="h-4 w-4" /> Print bill</button></div><div className="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 p-4">{bill.lines.map((line) => <div key={line.allocationKey} className="flex justify-between gap-3 py-2 text-sm"><span>{line.billableQuantity}× {line.dishNameSnapshot}</span><span>{money(line.lineTotal, currency)}</span></div>)}</div><dl className="space-y-2 text-sm">{[["Subtotal", bill.subtotal], ["Discount", -bill.discountAmount], ["Service charge", bill.serviceCharge], ["Tip", bill.tipAmount], ...(cgst || sgst || igst ? [["CGST", cgst], ["SGST", sgst], ["IGST", igst], ["Other tax", Math.max(0, bill.taxAmount - cgst - sgst - igst)]] : [["GST / tax", bill.taxAmount]])].filter(([label, value]) => Number(value) > 0.01 || (label === "Discount" && Number(value) < -0.01)).map(([label, value]) => <div key={label} className="flex justify-between"><dt>{label}</dt><dd>{money(Number(value), currency)}</dd></div>)}<div className="flex justify-between border-t border-neutral-200 pt-3 text-lg font-black"><dt>Total</dt><dd>{money(bill.total, currency)}</dd></div><div className="flex justify-between font-bold"><dt>Remaining</dt><dd>{money(bill.outstandingAmount, currency)}</dd></div></dl>
        {billNeedsUpdate ? <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">The table order changed. Tap Update bill before taking payment.</p> : bill.outstandingAmount > 0 ? <div className="space-y-3 border-t border-neutral-200 pt-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setMethod("CASH")} className={`rounded-xl px-4 py-2 text-sm font-bold ${method === "CASH" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>Cash</button><button type="button" onClick={() => setMethod("CARD")} className={`rounded-xl px-4 py-2 text-sm font-bold ${method === "CARD" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}>Card</button><button type="button" disabled={busy || !upiOrder} onClick={createUpi} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-bold disabled:opacity-40">UPI QR</button></div><button type="button" disabled={busy || unsentOrders.length > 0} onClick={recordPayment} className="min-h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">Record {method} received · {money(bill.outstandingAmount, currency)}</button>{!upiOrder ? <p className="text-xs text-neutral-500">A verified UPI QR is available when this bill matches one unpaid order without an extra tip. Cash or card can settle a consolidated bill.</p> : null}{upi ? <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center"><p className="font-bold">{restaurantName} · {locationName(table)} · {money(upi.amount, currency)}</p>{upi.qrImageUrl ? <Image unoptimized src={upi.qrImageUrl} alt={`UPI payment QR for bill ${bill.billNumber}`} width={280} height={280} className="mx-auto mt-3 h-70 w-70 max-w-full object-contain" /> : null}<p className="mt-2 text-sm">{upi.status === "PAID" ? "Payment verified" : upi.status === "PENDING" ? "Waiting for verified payment…" : `Payment ${upi.status.toLowerCase()}`}</p><button type="button" onClick={() => upiOrder && session && void run(() => refreshUpi(upiOrder.id, session))} className="mt-2 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold">Refresh status</button></div> : null}</div> : <div className="space-y-3 border-t border-neutral-200 pt-4"><p className="font-semibold text-emerald-700">Bill paid in full.</p><button type="button" disabled={busy || unsentOrders.length > 0} onClick={finishTable} className="min-h-12 w-full rounded-xl bg-emerald-700 px-4 text-base font-bold text-white disabled:opacity-50">Complete table &amp; free it</button><p className="text-xs text-neutral-500">This closes the paid table visit, keeps its history in Orders, and makes the table ready for the next guest.</p></div>}
      </div>}
    </section> : null}
  </div>;
}
