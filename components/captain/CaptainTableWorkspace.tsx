"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  ClipboardList,
  Plus,
  Sparkles,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { MasterBill, OrderSummary, RestaurantTable, TableSession } from "@/types";
import { locationName } from "@/lib/service-location";
import type { ServiceRequest, ServiceRequestType } from "@/types/service-request";
import { TABLE_STATUS_LABEL, TABLE_STATUS_STYLE } from "@/lib/captain-floor";
import { isPendingCaptainApproval } from "@/lib/order-authorization";
import { primaryFloorAction } from "@/lib/order-board";
import { printQueuedKitchenOrderTicket, printSessionKitchenTicket } from "@/lib/kot-print";
import UpiPaymentQr from "@/components/shared/UpiPaymentQr";

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type HistoryFilter = "ALL" | OrderSummary["status"];

const REQUEST_TYPES: { type: ServiceRequestType; label: string }[] = [
  { type: "WATER", label: "Water" },
  { type: "EXTRA_PLATES", label: "Extra plates" },
  { type: "CUTLERY", label: "Cutlery" },
  { type: "NAPKINS", label: "Napkins" },
  { type: "ASSISTANCE", label: "Assistance" },
  { type: "CLEANING", label: "Cleaning" },
  { type: "BILL", label: "Bill" },
  { type: "OTHER", label: "Other" },
];

export default function CaptainTableWorkspace({
  slug,
  restaurantName,
  captainName,
  currency,
  initialTable,
  availableTables,
  initialOrder,
  initialOrders,
  initialSession,
  initialBill,
  initialRequests,
  upiSettings,
}: {
  slug: string;
  restaurantName?: string;
  captainName: string;
  currency: string;
  initialTable: RestaurantTable;
  availableTables: RestaurantTable[];
  initialOrder: OrderSummary | null;
  initialOrders: OrderSummary[];
  initialSession: TableSession | null;
  initialBill: MasterBill | null;
  initialRequests: ServiceRequest[];
  upiSettings?: { enabled: boolean; upiId: string; payeeName: string; staticQrUrl?: string };
}) {
  const [table, setTable] = useState(initialTable);
  const [order, setOrder] = useState(initialOrder);
  const [orders, setOrders] = useState(initialOrders);
  const [session, setSession] = useState(initialSession);
  const [bill, setBill] = useState(initialBill);
  const [splitCount, setSplitCount] = useState(2);
  const [requests, setRequests] = useState(initialRequests);
  const [guestCount, setGuestCount] = useState(String(initialOrder?.guestCount ?? ""));
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("ALL");
  const [billServiceCharge, setBillServiceCharge] = useState("0");
  const [destinationTableId, setDestinationTableId] = useState("");
  const [pending, startTransition] = useTransition();

  const openRequests = useMemo(
    () => requests.filter((request) => !["DONE", "CANCELLED"].includes(request.status)),
    [requests],
  );
  const runningTotal = useMemo(() => orders.filter((row) => !["CANCELLED", "REJECTED", "REFUNDED"].includes(row.status)).reduce((sum, row) => sum + row.total, 0), [orders]);
  const previouslyPaid = useMemo(() => orders.reduce((sum, row) => sum + (row.payment?.amountPaid ?? 0), 0), [orders]);
  const historyOrders = useMemo(
    () => orders.filter((row) => historyFilter === "ALL" || row.status === historyFilter),
    [historyFilter, orders],
  );

  function runAction(action: string, body: Record<string, unknown> = {}) {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(`/api/captain/tables/${table.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...body }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Action failed");
        setTable(json.data);
        setMessage("Updated");
        const refresh = await fetch(`/api/captain/tables/${table.id}`);
        const refreshed = await refresh.json();
        if (refreshed.success) {
          setTable(refreshed.data.table);
          setOrder(refreshed.data.activeOrder);
          setOrders(refreshed.data.orders ?? []);
          setSession(refreshed.data.session ?? null);
          setBill(refreshed.data.bill ?? null);
          setRequests(refreshed.data.requests);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Action failed");
      }
    });
  }

  function createRequest(type: ServiceRequestType) {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/captain/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId: table.id, type, note: note.trim() || undefined }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Unable to create request");
        setRequests((prev) => [json.data, ...prev]);
        setNote("");
        setMessage(`${type.replace(/_/g, " ")} logged`);
        if (type === "BILL" || type === "CLEANING") {
          const refresh = await fetch(`/api/captain/tables/${table.id}`);
          const refreshed = await refresh.json();
          if (refreshed.success) setTable(refreshed.data.table);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to create request");
      }
    });
  }

  function advanceRequest(id: string, status: "ACKNOWLEDGED" | "IN_PROGRESS" | "DONE") {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/captain/requests/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Unable to update");
        setRequests((prev) => prev.map((row) => (row.id === id ? json.data : row)));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update request");
      }
    });
  }

  function refreshTable() {
    return fetch(`/api/captain/tables/${table.id}`)
      .then((response) => response.json())
      .then((refreshed) => {
        if (refreshed.success) {
          setTable(refreshed.data.table);
          setOrder(refreshed.data.activeOrder);
          setOrders(refreshed.data.orders ?? []);
          setSession(refreshed.data.session ?? null);
          setBill(refreshed.data.bill ?? null);
          setRequests(refreshed.data.requests);
        }
      });
  }

  function generateFinalBill(revise = false) {
    if (!session) return;
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(`/api/captain/tables/${table.id}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "GENERATE_BILL", sessionId: session.id, revise, tipAmount: Number(billServiceCharge) || 0 }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Unable to generate final bill");
        setBill(json.data);
        setMessage(`Final bill ${json.data.billNumber} generated`);
        await refreshTable();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to generate final bill");
      }
    });
  }

  function sessionBillingAction(body: Record<string, unknown>, success: string) {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(`/api/captain/tables/${table.id}/session`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Billing action failed");
        if (body.action === "SPLIT_BILL" || body.action === "RECORD_PAYMENT") setBill(json.data);
        setMessage(success);
        await refreshTable();
      } catch (error) { setMessage(error instanceof Error ? error.message : "Billing action failed"); }
    });
  }

  function moveOrMerge(action: "MOVE_TABLE" | "MERGE_TABLE") {
    if (!session || !destinationTableId) return;
    const destination = availableTables.find((row) => row.id === destinationTableId);
    if (!destination) return;
    sessionBillingAction(action === "MOVE_TABLE" ? { action, sessionId: session.id, destinationTableId: destination.id, destinationTableNumber: destination.tableNumber, destinationLocationType: destination.locationType ?? "TABLE" } : { action, sessionId: session.id, destinationSessionId: destinationTableId }, action === "MOVE_TABLE" ? `Moved session to ${locationName(destination)}` : `Merged into ${locationName(destination)}`);
  }

  /** Approval clears the captain gate; a separate acceptance sends the order to kitchen. */
  function sendToKitchen() {
    if (!order) return;
    startTransition(async () => {
      setMessage(null);
      try {
        if (isPendingCaptainApproval(order)) {
          const response = await fetch(`/api/captain/orders/${order.id}/authorize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              decision: "APPROVE",
              idempotencyKey: crypto.randomUUID(),
              sendToKitchen: false,
            }),
          });
          const json = await response.json();
          if (!json.success) throw new Error(json.error || "Unable to approve order");
          setOrder(json.data);
          setMessage(`Order #${order.orderNumber} approved · now waiting in New orders`);
        } else {
          const sentBefore = order.kotLineIds ?? [];
          const response = await fetch(`/api/captain/orders/${order.id}/send-kot`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
          const json = await response.json();
          if (!json.success) throw new Error(json.error || "Unable to send to kitchen");
          setOrder(json.data);
          printQueuedKitchenOrderTicket(json.data, restaurantName, sentBefore);
          setMessage(`Order #${order.orderNumber} sent to kitchen`);
        }
        await refreshTable();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to send to kitchen");
      }
    });
  }

  function advanceOrderStatus(status: OrderSummary["status"], label: string) {
    if (!order) return;
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(`/api/captain/orders/${order.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || `Unable to ${label.toLowerCase()}`);
        setOrder(json.data);
        setMessage(`${label} · #${order.orderNumber}`);
        await refreshTable();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update order");
      }
    });
  }

  function setItemPrep(lineId: string, preparationStatus: "PREPARING" | "READY") {
    if (!order) return;
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(`/api/kitchen/orders/${order.id}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, preparationStatus }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Unable to update item");
        setOrder(json.data);
        await refreshTable();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update item");
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <Link
            href={`/captain/${slug}/tables`}
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" /> My Tables
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight">{locationName(table)}</h1>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${TABLE_STATUS_STYLE[table.status]}`}
            >
              {TABLE_STATUS_LABEL[table.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {table.label || "Dining table"} · {table.capacity ?? "—"} seats · Captain {captainName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/captain/${slug}/take-order?table=${table.tableNumber}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-bold text-white"
          >
            <UtensilsCrossed className="h-4 w-4" />
            {order ? "Add items" : "New order"}
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => runAction("START_SERVICE")}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold"
          >
            <Sparkles className="h-4 w-4" /> Start service
          </button>
        </div>
      </header>

      {message ? (
        <p
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            /unable|failed|cannot|no active/i.test(message)
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {message}
        </p>
      ) : null}

      <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">Table session</p>
            <h2 className="mt-1 text-xl font-black">{session?.sessionNumber ?? "Starts with first order"}</h2>
            <p className="mt-1 text-sm text-neutral-500">{orders.length} independent order{orders.length === 1 ? "" : "s"} · Running bill {money(runningTotal, currency)} · Paid {money(previouslyPaid, currency)}</p>
          </div>
          <div className="flex flex-wrap items-end gap-2"><label className="text-xs font-semibold text-neutral-600">Service charge / tip<input type="number" min="0" step="0.01" value={billServiceCharge} onChange={(event) => setBillServiceCharge(event.target.value)} className="mt-1 block h-10 w-32 rounded-lg border border-neutral-300 px-2 text-sm" /></label><button type="button" disabled={pending || !session || orders.length === 0} onClick={() => generateFinalBill(Boolean(bill))} className="min-h-11 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white disabled:opacity-40">{bill ? "Generate revised bill" : "Finalize bill"}</button><button type="button" disabled={orders.length === 0} onClick={() => printSessionKitchenTicket(orders.filter((row) => !["CANCELLED", "REJECTED", "REFUNDED"].includes(row.status)), restaurantName, locationName(table))} className="min-h-11 rounded-xl border border-neutral-300 px-4 text-sm font-bold">Print session KOT</button></div>
        </div>
        {orders.length ? (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {orders.map((row) => <button key={row.id} type="button" onClick={() => setOrder(row)} className={`min-w-36 rounded-xl border px-3 py-2 text-left text-xs ${order?.id === row.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200"}`}><strong className="block">Order #{row.orderNumber}</strong><span>{row.status} · {money(row.total, currency)}</span></button>)}
          </div>
        ) : null}
        {session ? <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-neutral-200 bg-neutral-50 p-3"><label className="text-xs font-semibold text-neutral-600">Table tools<select value={destinationTableId} onChange={(event) => setDestinationTableId(event.target.value)} className="mt-1 block h-10 rounded-lg border border-neutral-300 bg-white px-2 text-sm"><option value="">Select destination</option>{availableTables.filter((row) => row.id !== table.id && row.isActive && row.status !== "CLOSED").map((row) => <option key={row.id} value={row.id}>{locationName(row)}</option>)}</select></label><button type="button" disabled={!destinationTableId || pending} onClick={() => moveOrMerge("MOVE_TABLE")} className="h-10 rounded-lg border border-neutral-300 px-3 text-xs font-bold">Move table</button><button type="button" disabled={!destinationTableId || pending} onClick={() => moveOrMerge("MERGE_TABLE")} className="h-10 rounded-lg border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-900">Merge tables</button></div> : null}
        {bill ? (
          <div className="mt-4 grid gap-3 rounded-2xl bg-violet-50 p-4 sm:grid-cols-3">
            <div><p className="text-xs text-violet-700">Final bill</p><p className="font-bold">{bill.billNumber} · v{bill.version}</p></div>
            <div><p className="text-xs text-violet-700">Subtotal</p><p className="font-bold">{money(bill.subtotal, currency)}</p></div>
            <div><p className="text-xs text-violet-700">Charges & tax</p><p className="font-semibold">{bill.serviceCharge > 0 ? `Service ${money(bill.serviceCharge, currency)} · ` : ""}{bill.packagingCharge > 0 ? `Pack ${money(bill.packagingCharge, currency)} · ` : ""}GST {money(bill.taxAmount, currency)}</p><p className="text-xs text-neutral-500">CGST/SGST included where applicable</p></div>
            <div><p className="text-xs text-violet-700">Total / Paid</p><p className="font-bold">{money(bill.total, currency)} / {money(bill.amountPaid, currency)}</p></div>
            <div><p className="text-xs text-violet-700">Outstanding</p><p className="text-lg font-black">{money(bill.outstandingAmount, currency)}</p></div>
            {bill.outstandingAmount > 0 && upiSettings?.enabled && (upiSettings.upiId || upiSettings.staticQrUrl) ? <div className="sm:col-span-3"><UpiPaymentQr upiId={upiSettings.upiId} payeeName={upiSettings.payeeName} staticQrUrl={upiSettings.staticQrUrl} amount={bill.outstandingAmount} orderNumber={bill.billNumber} compact /></div> : null}
            {bill.outstandingAmount > 0 && bill.allocations.length === 0 ? <button type="button" disabled={pending} onClick={() => sessionBillingAction({ action: "RECORD_PAYMENT", billId: bill.id, amount: bill.outstandingAmount, method: "UPI", idempotencyKey: crypto.randomUUID() }, "UPI payment recorded after verification")} className="min-h-10 rounded-xl border border-violet-300 bg-white px-4 text-sm font-bold text-violet-900 sm:col-span-3">Verified payment received · record UPI</button> : null}
            {bill.amountPaid === 0 ? <div className="flex flex-wrap items-center gap-2 sm:col-span-3"><label className="text-xs font-semibold">Equal split customers <input type="number" min={2} max={50} value={splitCount} onChange={(event) => setSplitCount(Math.max(2, Math.min(50, Number(event.target.value) || 2)))} className="ml-2 h-9 w-16 rounded-lg border border-violet-200 px-2" /></label><button type="button" disabled={pending} onClick={() => sessionBillingAction({ action: "SPLIT_BILL", billId: bill.id, version: bill.version, mode: "EQUAL", customers: splitCount }, "Bill split equally")} className="h-9 rounded-lg bg-violet-700 px-3 text-xs font-bold text-white">Split equally</button></div> : null}
            {bill.allocations.length ? <div className="space-y-2 sm:col-span-3">{bill.allocations.map((allocation) => <div key={allocation.id} className="rounded-xl border border-violet-200 bg-white p-3"><div className="flex items-center justify-between gap-3"><span className="font-semibold">{allocation.label}</span><span className="font-bold">{money(allocation.amount - allocation.amountPaid, currency)} due</span></div>{allocation.amountPaid < allocation.amount && upiSettings?.enabled && upiSettings.upiId ? <div className="mt-2"><UpiPaymentQr upiId={upiSettings.upiId} payeeName={upiSettings.payeeName} amount={allocation.amount - allocation.amountPaid} orderNumber={`${bill.billNumber}-${allocation.id}`} compact /><button type="button" disabled={pending} onClick={() => sessionBillingAction({ action: "RECORD_PAYMENT", billId: bill.id, allocationId: allocation.id, amount: allocation.amount - allocation.amountPaid, method: "UPI", idempotencyKey: crypto.randomUUID() }, `${allocation.label} payment recorded`)} className="mt-2 min-h-9 w-full rounded-lg bg-violet-700 px-3 text-xs font-bold text-white">Verified · record UPI payment</button></div> : null}</div>)}</div> : null}
            {bill.status === "PAID" && session ? <button type="button" disabled={pending} onClick={() => sessionBillingAction({ action: "CLOSE_SESSION", sessionId: session.id }, "Session closed · table sent to cleaning")} className="min-h-10 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white sm:col-span-3">Close paid session</button> : null}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="complete-order-history" className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">Session timeline</p>
            <h2 id="complete-order-history" className="mt-1 text-xl font-black">Complete order history</h2>
            <p className="mt-1 text-sm text-neutral-500">Every independent order stays visible for this session. Sorted oldest to newest.</p>
          </div>
          <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-bold text-neutral-600">{orders.length} order{orders.length === 1 ? "" : "s"}</span>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {(["ALL", "PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED"] as const).map((filter) => (
            <button key={filter} type="button" onClick={() => setHistoryFilter(filter)} className={`min-h-9 shrink-0 rounded-full border px-3 text-xs font-bold ${historyFilter === filter ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600"}`}>
              {filter === "ALL" ? "All orders" : filter[0] + filter.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {historyOrders.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-5 text-center text-sm text-neutral-500">No orders match this filter.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {historyOrders.map((row) => (
              <li key={row.id} className={`rounded-2xl border p-4 ${order?.id === row.id ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <button type="button" onClick={() => setOrder(row)} className="text-left">
                    <p className="font-black">Order #{row.orderNumber}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{new Date(row.createdAt).toLocaleString()} · {(row.source ?? row.channel ?? "ORDER").replace(/_/g, " ")}</p>
                  </button>
                  <div className="text-right"><p className="font-black tabular-nums">{money(row.total, currency)}</p><p className="text-xs text-neutral-500">{row.status} · {row.payment?.status ?? "UNPAID"}</p></div>
                </div>
                <div className="mt-3 divide-y divide-neutral-100 rounded-xl bg-white">
                  {row.items.map((item, index) => <div key={item.lineId ?? `${row.id}-${index}`} className="flex items-start justify-between gap-3 px-3 py-2 text-sm"><span><strong>{item.quantity}× {item.dishNameSnapshot}</strong>{item.variantNameSnapshot ? ` · ${item.variantNameSnapshot}` : ""}<span className="block text-[11px] text-neutral-500">{(item.kitchenStation ?? "MAIN").toLowerCase()} · {item.preparationStatus ?? "QUEUED"}{item.note ? ` · ${item.note}` : ""}</span></span><span className="shrink-0 tabular-nums">{money(item.itemTotal, currency)}</span></div>)}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500"><span>KOT #{row.orderNumber} · Kitchen {row.status}</span><span>{row.payment?.amountPaid ? `Paid ${money(row.payment.amountPaid, currency)}` : "Payment unpaid"}</span></div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Selected order</h2>
            {order ? (
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                #{order.orderNumber} · {order.status}
              </span>
            ) : null}
          </div>

          {!order ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
              <p className="font-semibold">No active order</p>
              <p className="mt-1 text-sm text-neutral-500">
                Take a verbal order — guest phone not required.
              </p>
              <Link
                href={`/captain/${slug}/take-order?table=${table.tableNumber}`}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" /> Start ordering
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <p className="text-[11px] uppercase text-neutral-400">Amount</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{money(order.total, currency)}</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <p className="text-[11px] uppercase text-neutral-400">Payment</p>
                  <p className="mt-1 font-semibold">{order.payment?.status ?? "UNPAID"}</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <p className="text-[11px] uppercase text-neutral-400">Items</p>
                  <p className="mt-1 font-semibold">{order.items.length}</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <p className="text-[11px] uppercase text-neutral-400">Kitchen</p>
                  <p className="mt-1 font-semibold">
                    {order.items.filter((item) => item.preparationStatus === "READY").length}/
                    {order.items.length} ready
                  </p>
                </div>
              </div>

              {/* Next step first — sticky so you never hunt below the item list */}
              <div className="sticky top-14 z-10 space-y-2 rounded-2xl border border-neutral-200 bg-white/95 p-3 shadow-sm backdrop-blur-md lg:top-4">
                {isPendingCaptainApproval(order) ? (
                  <p className="text-sm text-amber-950">
                    Customer QR order — approve it first. It will remain under New until accepted.
                  </p>
                ) : order.status === "PENDING" ? (
                  <p className="text-sm text-sky-950">New order waiting — accept to send KOT to kitchen.</p>
                ) : (
                  <p className="text-sm text-neutral-600">
                    Next floor step for #{order.orderNumber}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {order.status === "PENDING" || isPendingCaptainApproval(order) ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={sendToKitchen}
                      className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-neutral-900 px-4 text-sm font-bold text-white disabled:opacity-50 sm:flex-none"
                    >
                      {isPendingCaptainApproval(order)
                        ? "Approve order"
                        : "Accept & send to kitchen"}
                    </button>
                  ) : null}
                  {(() => {
                    const action = primaryFloorAction(order.status);
                    if (!action || order.status === "PENDING") return null;
                    return (
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => advanceOrderStatus(action.status, action.label)}
                        className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#e7c27d] px-4 text-sm font-bold text-neutral-900 disabled:opacity-50 sm:flex-none"
                      >
                        {action.label}
                      </button>
                    );
                  })()}
                  <Link
                    href={`/captain/${slug}/take-order?table=${table.tableNumber}`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-300 px-4 text-sm font-semibold"
                  >
                    <Plus className="h-4 w-4" /> Add items
                  </Link>
                  <Link
                    href={`/captain/${slug}/kitchen`}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-300 px-4 text-sm font-semibold"
                  >
                    <ClipboardList className="h-4 w-4" /> KOT / kitchen
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => runAction("REQUEST_BILL")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-violet-600 px-4 text-sm font-bold text-white"
                  >
                    <Wallet className="h-4 w-4" /> Request bill
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-100">
                {order.items.map((item, index) => {
                  const lineId = item.lineId ?? `legacy-${index}`;
                  const inKitchen = ["ACCEPTED", "PREPARING", "READY"].includes(order.status);
                  return (
                    <li
                      key={lineId}
                      className="flex flex-col gap-2 px-3 py-2.5 text-sm sm:flex-row sm:items-start sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {item.quantity}× {item.dishNameSnapshot}
                          {item.variantNameSnapshot ? ` · ${item.variantNameSnapshot}` : ""}
                        </p>
                        {item.note ? <p className="text-xs text-neutral-500">{item.note}</p> : null}
                        <p className="text-[11px] uppercase tracking-wide text-neutral-400">
                          {(item.kitchenStation ?? "MAIN").toLowerCase()} ·{" "}
                          {(item.preparationStatus ?? "QUEUED").toLowerCase()}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <p className="tabular-nums font-medium">{money(item.itemTotal, currency)}</p>
                        {inKitchen ? (
                          <>
                            <button
                              type="button"
                              disabled={pending || item.preparationStatus === "PREPARING"}
                              onClick={() => setItemPrep(lineId, "PREPARING")}
                              className="rounded-lg border border-neutral-300 px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                            >
                              Start
                            </button>
                            <button
                              type="button"
                              disabled={pending || item.preparationStatus === "READY"}
                              onClick={() => setItemPrep(lineId, "READY")}
                              className="rounded-lg bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40"
                            >
                              Item ready
                            </button>
                          </>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Service notes</h2>
            <label className="mt-3 block text-sm">
              Guest count
              <input
                type="number"
                min={1}
                max={100}
                value={guestCount}
                onChange={(event) => setGuestCount(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              />
            </label>
            <label className="mt-3 block text-sm">
              Note / request detail
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2"
                placeholder="Allergy note, preference…"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => runAction("ADD_NOTE", { note })}
                className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold"
              >
                Save note
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => runAction("REQUEST_CLEANING")}
                className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold"
              >
                Request cleaning
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => runAction("COMPLETE_CLEANING")}
                className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
              >
                Mark available
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <BellRing className="h-4 w-4" />
              <h2 className="text-lg font-bold">Customer requests</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  disabled={pending}
                  onClick={() => createRequest(type)}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold hover:border-neutral-900"
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="mt-4 space-y-2">
              {openRequests.length === 0 ? (
                <li className="text-sm text-neutral-500">No open requests.</li>
              ) : (
                openRequests.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-100 px-3 py-2 text-sm"
                  >
                    <span>
                      {request.type.replace(/_/g, " ")} · {request.status}
                      {request.note ? ` — ${request.note}` : ""}
                    </span>
                    <span className="flex gap-1">
                      {request.status === "OPEN" ? (
                        <button
                          type="button"
                          className="rounded-lg bg-neutral-900 px-2 py-1 text-[11px] font-bold text-white"
                          onClick={() => advanceRequest(request.id, "ACKNOWLEDGED")}
                        >
                          Ack
                        </button>
                      ) : null}
                      {request.status !== "DONE" ? (
                        <button
                          type="button"
                          className="rounded-lg border border-neutral-300 px-2 py-1 text-[11px] font-semibold"
                          onClick={() => advanceRequest(request.id, "DONE")}
                        >
                          Done
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
