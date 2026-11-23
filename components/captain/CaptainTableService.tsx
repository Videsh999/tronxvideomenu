"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Printer, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import UpiPaymentQr from "@/components/shared/UpiPaymentQr";
import type { DynamicPaymentRequest, MasterBill, MasterBillLine, OrderSummary, RestaurantTable, TableSession } from "@/types";
import { locationName } from "@/lib/service-location";
import { printQueuedKitchenOrderTicket, printSessionKitchenTicket } from "@/lib/kot-print";
import { isPendingCaptainApproval } from "@/lib/order-authorization";
import { buildUpiPaymentUri, isValidUpiId } from "@/lib/upi-payment";
import { serviceTaxAmount, type ServiceTaxMode } from "@/lib/billing/service-tax";

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

export default function CaptainTableService({
  slug,
  restaurantName,
  table,
  currency,
  upiSettings,
  initialOrders,
  initialSession,
  initialBill,
  openBillOnLoad = false,
  initialTipPercent,
}: {
  slug: string;
  restaurantName: string;
  table: RestaurantTable;
  currency: string;
  upiSettings: { enabled: boolean; upiId: string; payeeName: string; staticQrUrl?: string };
  initialOrders: OrderSummary[];
  initialSession: TableSession | null;
  initialBill: MasterBill | null;
  openBillOnLoad?: boolean;
  initialTipPercent?: number;
}) {
  const router = useRouter();
  const saveLock = useRef(false);
  const autoBillStarted = useRef(false);
  const [orders, setOrders] = useState(initialOrders);
  const [session, setSession] = useState(initialSession);
  const [bill, setBill] = useState(initialBill);
  const [serviceTaxMode, setServiceTaxMode] = useState<ServiceTaxMode>(
    initialBill?.tipAmount ? "AMOUNT" : initialTipPercent != null ? "PERCENT" : "PERCENT",
  );
  const [serviceTaxPercent, setServiceTaxPercent] = useState(
    initialTipPercent != null ? String(initialTipPercent) : "",
  );
  const [serviceTaxAmountInput, setServiceTaxAmountInput] = useState(initialBill?.tipAmount ? String(initialBill.tipAmount) : "");
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
  const foodBase = Math.max(0, activeOrders.reduce((sum, order) => sum + order.subtotal - (order.billDiscountAmount ?? 0), 0));
  const serviceTaxRupees = serviceTaxAmount(foodBase, serviceTaxMode, serviceTaxPercent, serviceTaxAmountInput);
  const unsentOrders = activeOrders.filter((order) => order.status === "PENDING" || order.items.some((item) => item.lineId && !(order.kotLineIds ?? []).includes(item.lineId) && ((order.kotLineIds ?? []).length > 0 || order.status === "ACCEPTED")));
  const billNeedsUpdate = Boolean(bill && (Math.abs(bill.total - bill.tipAmount - orderTotal) >= 0.01 || Math.abs(bill.tipAmount - (serviceTaxRupees)) >= 0.01));
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

  function localBill(): MasterBill | null {
    if (!session) return null;
    const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const lines: MasterBillLine[] = [];
    for (const order of activeOrders) {
      order.items.forEach((item, index) => {
        const billableQuantity = Math.max(0, item.quantity - (item.cancelledQuantity ?? 0));
        if (!billableQuantity || item.quantity <= 0) return;
        const lineId = item.lineId ?? `${item.dishId}-${index}`;
        lines.push({
          allocationKey: `${order.id}:${lineId}`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          lineId,
          dishNameSnapshot: item.dishNameSnapshot,
          quantity: item.quantity,
          billableQuantity,
          lineTotal: round2(item.itemTotal * (billableQuantity / item.quantity)),
        });
      });
    }
    const now = new Date().toISOString();
    const total = round2(orderTotal + serviceTaxRupees);
    const alreadyPaid = bill?.amountPaid ?? activeOrders.reduce((sum, order) => sum + (order.payment?.amountPaid ?? 0), 0);
    const amountPaid = round2(Math.min(total, alreadyPaid));
    const outstandingAmount = round2(Math.max(0, total - amountPaid));
    return {
      id: bill?.id && bill.id !== "local-bill" ? bill.id : "local-bill",
      billNumber: bill?.billNumber && bill.id !== "local-bill" ? bill.billNumber : "…",
      restaurantId: bill?.restaurantId ?? "",
      tableSessionId: session.id,
      serviceLocationId: table.id,
      version: bill?.version ?? 0,
      status: outstandingAmount === 0 ? "PAID" : "ISSUED",
      orderIds: activeOrders.map((order) => order.id),
      lines,
      subtotal: round2(activeOrders.reduce((sum, order) => sum + order.subtotal, 0)),
      discountAmount: round2(activeOrders.reduce((sum, order) => sum + (order.billDiscountAmount ?? 0), 0)),
      taxAmount: round2(activeOrders.reduce((sum, order) => sum + (order.taxAmount ?? 0), 0)),
      packagingCharge: round2(activeOrders.reduce((sum, order) => sum + (order.packagingCharge ?? 0), 0)),
      serviceCharge: round2(activeOrders.reduce((sum, order) => sum + (order.serviceCharge ?? 0), 0)),
      tipAmount: serviceTaxRupees,
      total,
      amountPaid,
      outstandingAmount,
      fingerprint: bill?.fingerprint ?? "",
      splitMode: "NONE",
      allocations: [],
      paymentLedger: bill?.paymentLedger ?? [],
      issuedAt: now,
      issuedBy: bill?.issuedBy ?? { role: "CAPTAIN", id: "local", name: "Captain" },
      createdAt: bill?.createdAt ?? now,
      updatedAt: now,
    };
  }

  function sendKot() {
    const previous = orders;
    setOrders((current) => current.map((order) => {
      const lineIds = order.items.map((item) => item.lineId).filter((id): id is string => Boolean(id));
      return { ...order, status: order.status === "ACCEPTED" ? "PREPARING" : order.status, kotLineIds: [...new Set([...(order.kotLineIds ?? []), ...lineIds])] };
    }));
    setMessage("Sent to the kitchen.");
    void dispatchUnsentOrders()
      .then((batch) => {
        if (batch.length === 1) printQueuedKitchenOrderTicket(batch[0], restaurantName, []);
        else if (batch.length > 1) printSessionKitchenTicket(batch, restaurantName, locationName(table));
      })
      .catch((error) => {
        setOrders(previous);
        setMessage(error instanceof Error ? error.message : "Could not send the KOT.");
      });
  }

  function showBill() {
    if (saveLock.current) return;
    if (activeOrders.some((order) => isPendingCaptainApproval(order))) {
      setMessage("Approve the guest’s QR order first, then show the bill.");
      return;
    }
    if (!session && !activeOrders.length) {
      setMessage("No items on this table yet.");
      return;
    }
    const previous = bill;
    const preview = localBill();
    if (preview) setBill(preview);
    setMessage("Preparing bill…");
    saveLock.current = true;
    void (async () => {
      try {
        // Send any waiting KOT lines first so the bill matches the kitchen ticket.
        if (unsentOrders.length) {
          await dispatchUnsentOrders();
          await refresh();
        }
        let sessionId = session?.id;
        if (!sessionId) {
          const overview = await refresh();
          sessionId = overview.session?.id;
        }
        if (!sessionId) throw new Error("No active table visit. Refresh and try again.");
        const updated = await postSession({
          action: "GENERATE_BILL",
          sessionId,
          tipAmount: serviceTaxRupees,
          revise: Boolean(previous && previous.id !== "local-bill"),
        });
        setBill(updated);
        setMessage("Bill ready — record payment below.");
        window.requestAnimationFrame(() => {
          document.getElementById("customer-bill")?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      } catch (error) {
        setBill(previous);
        setMessage(error instanceof Error ? error.message : "Could not save the bill.");
      } finally {
        saveLock.current = false;
      }
    })();
  }

  useEffect(() => {
    if (!openBillOnLoad || autoBillStarted.current) return;
    if (!activeOrders.length) return;
    autoBillStarted.current = true;
    const timer = window.setTimeout(() => showBill(), 250);
    return () => window.clearTimeout(timer);
    // Intentionally once when arriving from KOT & Bill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openBillOnLoad, activeOrders.length]);

  function recordPayment() {
    if (!bill || bill.id === "local-bill" || billNeedsUpdate || unsentOrders.length || saveLock.current) return;
    const amount = bill.outstandingAmount;
    if (!window.confirm(`Confirm ${money(amount, currency)} received by ${method}?`)) return;
    const previous = bill;
    const paid = Math.round((bill.amountPaid + amount) * 100) / 100;
    setBill({ ...bill, amountPaid: paid, outstandingAmount: Math.max(0, Math.round((bill.total - paid) * 100) / 100), status: paid + 0.001 >= bill.total ? "PAID" : "PARTIALLY_PAID" });
    setMessage("Payment recorded. You can finish the table now.");
    saveLock.current = true;
    void postSession({ action: "RECORD_PAYMENT", billId: bill.id, amount, method, idempotencyKey: crypto.randomUUID() })
      .then((updated) => setBill(updated))
      .catch((error) => {
        setBill(previous);
        setMessage(error instanceof Error ? error.message : "Could not record the payment.");
      })
      .finally(() => { saveLock.current = false; });
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
    if (activeOrders.some((order) => isPendingCaptainApproval(order))) {
      setMessage("Approve the guest’s QR order first. Then end the table visit.");
      return;
    }
    void run(async () => {
      const currentSession = session ?? (await refresh()).session;
      if (!currentSession) throw new Error("No active table visit was found. Refresh the table and try again.");
      let finalBill = bill;
      if (!finalBill || billNeedsUpdate) {
        finalBill = await postSession({ action: "GENERATE_BILL", sessionId: currentSession.id, tipAmount: serviceTaxRupees, revise: Boolean(finalBill) });
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

  const awaitingQr = activeOrders.some((order) => isPendingCaptainApproval(order));
  const billReady = Boolean(bill && bill.id !== "local-bill");
  const due = billReady ? bill!.outstandingAmount : orderTotal + serviceTaxRupees;
  const paidFull = billReady && bill!.outstandingAmount <= 0.009;

  return (
    <div className="mx-auto max-w-lg space-y-4 pb-44">
      <Link
        href={`/captain/${slug}/tables`}
        className="inline-flex min-h-11 items-center gap-2 text-base font-bold text-neutral-600"
      >
        <ArrowLeft className="h-5 w-5" /> Tables
      </Link>

      <header className="rounded-3xl bg-neutral-900 p-5 text-white">
        <p className="text-sm text-white/60">{table.label || "Table"}</p>
        <h1 className="mt-1 text-4xl font-black">{locationName(table)}</h1>
        <p className="mt-2 text-lg font-semibold text-white/90">
          {activeOrders.length ? money(orderTotal, currency) : "Empty — add food"}
        </p>
      </header>

      {message ? (
        <p role="status" className="rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-base font-bold">
          {message}
        </p>
      ) : null}

      <section className="rounded-3xl border border-neutral-200 bg-white p-4">
        <h2 className="text-lg font-black">Food on table</h2>
        {activeOrders.length ? (
          <ul className="mt-3 space-y-2">
            {activeOrders.flatMap((order) =>
              order.items
                .filter((item) => item.quantity > (item.cancelledQuantity ?? 0))
                .map((item, index) => (
                  <li
                    key={`${order.id}-${item.lineId ?? index}`}
                    className="flex items-start justify-between gap-3 border-b border-neutral-100 py-2 text-base"
                  >
                    <span className="font-semibold">
                      {item.quantity - (item.cancelledQuantity ?? 0)} × {item.dishNameSnapshot}
                    </span>
                    <span className="shrink-0 font-bold">{money(item.itemTotal, currency)}</span>
                  </li>
                )),
            )}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl border border-dashed border-neutral-300 p-6 text-center text-base text-neutral-500">
            No food yet. Tap <strong>Add food</strong> below.
          </p>
        )}
      </section>

      <section id="customer-bill" className="rounded-3xl border-2 border-blue-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black">Bill</h2>
          {billReady ? (
            <button
              type="button"
              onClick={() =>
                void printBill(bill!, orders, restaurantName, locationName(table), currency, upiSettings).catch(
                  (error) => setMessage(error instanceof Error ? error.message : "Print failed"),
                )
              }
              className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-neutral-300 px-3 text-sm font-bold"
            >
              <Printer className="h-4 w-4" /> Print
            </button>
          ) : null}
        </div>

        {awaitingQr ? (
          <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
            Guest phone order waiting — approve it first.
          </p>
        ) : null}

        {billReady ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-neutral-500">Bill {bill!.billNumber}</p>
            <p className="text-3xl font-black">{money(bill!.total, currency)}</p>
            <p className={`text-lg font-bold ${paidFull ? "text-emerald-700" : "text-amber-700"}`}>
              {paidFull ? "Paid ✓" : `Still due ${money(bill!.outstandingAmount, currency)}`}
            </p>
            {bill!.outstandingAmount > 0 &&
            upiSettings.enabled &&
            (isValidUpiId(upiSettings.upiId) || upiSettings.staticQrUrl) ? (
              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                <UpiPaymentQr
                  upiId={upiSettings.upiId}
                  payeeName={upiSettings.payeeName}
                  staticQrUrl={upiSettings.staticQrUrl}
                  amount={bill!.outstandingAmount}
                  orderNumber={bill!.billNumber}
                  compact
                />
              </div>
            ) : null}
            {billNeedsUpdate ? (
              <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">
                Food changed. Tap Show bill again.
              </p>
            ) : null}
            {billReady && bill!.outstandingAmount > 0 && !billNeedsUpdate ? (
              <div className="space-y-2 pt-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod("CASH")}
                    className={`min-h-12 rounded-2xl text-base font-bold ${method === "CASH" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}
                  >
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod("CARD")}
                    className={`min-h-12 rounded-2xl text-base font-bold ${method === "CARD" ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}
                  >
                    Card
                  </button>
                </div>
                <button
                  type="button"
                  disabled={busy || unsentOrders.length > 0}
                  onClick={recordPayment}
                  className="min-h-14 w-full rounded-2xl bg-emerald-600 text-lg font-black text-white disabled:opacity-40"
                >
                  Money received · {money(bill!.outstandingAmount, currency)}
                </button>
                {upiOrder ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={createUpi}
                    className="min-h-12 w-full rounded-2xl border border-neutral-300 text-base font-bold"
                  >
                    UPI QR
                  </button>
                ) : null}
                {upi ? (
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-center">
                    <p className="font-bold">{money(upi.amount, currency)}</p>
                    {upi.qrImageUrl ? (
                      <Image
                        unoptimized
                        src={upi.qrImageUrl}
                        alt="UPI QR"
                        width={240}
                        height={240}
                        className="mx-auto mt-2"
                      />
                    ) : null}
                    <p className="mt-2 text-sm font-semibold">
                      {upi.status === "PAID" ? "Paid ✓" : "Waiting for UPI…"}
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-2xl font-black text-neutral-800">{money(due, currency)}</p>
        )}

        <details className="mt-4 rounded-2xl border border-neutral-200 p-3">
          <summary className="cursor-pointer text-sm font-bold text-neutral-600">Extra tip / service (optional)</summary>
          <div className="mt-3 grid gap-2">
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.1"
              placeholder="Tip % (example 5)"
              value={serviceTaxPercent}
              onChange={(event) => {
                setServiceTaxMode("PERCENT");
                setServiceTaxPercent(event.target.value);
              }}
              className="min-h-12 rounded-xl border border-neutral-300 px-3 text-base"
            />
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              placeholder="Or tip ₹ amount"
              value={serviceTaxAmountInput}
              onChange={(event) => {
                setServiceTaxMode("AMOUNT");
                setServiceTaxAmountInput(event.target.value);
              }}
              className="min-h-12 rounded-xl border border-neutral-300 px-3 text-base"
            />
          </div>
        </details>
      </section>

      {/* One clear action stack — always visible */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-neutral-200 bg-white/98 p-3 backdrop-blur lg:static lg:rounded-3xl lg:border lg:p-4">
        <div className="mx-auto grid max-w-lg gap-2">
          <Link
            href={`/captain/${slug}/take-order?table=${encodeURIComponent(table.id)}`}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-blue-700 text-lg font-black text-white"
          >
            <Plus className="h-6 w-6" /> 1. Add food
          </Link>
          {unsentOrders.length > 0 ? (
            <button
              type="button"
              disabled={busy}
              onClick={sendKot}
              className="min-h-14 rounded-2xl bg-amber-500 text-lg font-black text-neutral-950 disabled:opacity-50"
            >
              2. Send kitchen ({unsentOrders.length})
            </button>
          ) : activeOrders.length > 0 ? (
            <p className="rounded-2xl bg-emerald-50 px-3 py-2 text-center text-sm font-bold text-emerald-800">
              Kitchen has the order ✓
            </p>
          ) : null}
          <button
            type="button"
            disabled={busy || !activeOrders.length || awaitingQr}
            onClick={showBill}
            className="min-h-14 rounded-2xl bg-blue-600 text-lg font-black text-white disabled:opacity-40"
          >
            {billReady ? "3. Update bill" : "3. Show bill"}
          </button>
          <button
            type="button"
            disabled={busy || !paidFull}
            onClick={endTableVisit}
            className="min-h-14 rounded-2xl bg-neutral-900 text-lg font-black text-white disabled:opacity-35"
          >
            {busy ? "Please wait…" : paidFull ? "4. Free table" : "4. Free table (pay first)"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMessage("Updated.");
              void refresh().catch((error) =>
                setMessage(error instanceof Error ? error.message : "Could not refresh."),
              );
            }}
            className="inline-flex min-h-11 items-center justify-center gap-2 text-sm font-semibold text-neutral-500"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
