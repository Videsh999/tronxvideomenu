"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { OrderSummary, PaymentMethod } from "@/types";
import { ChevronDown, ChevronUp, Download, Printer, RefreshCw } from "lucide-react";
import {
  ORDER_BOARD_STAGES,
  canCancelOrder,
  canReprintKot,
  formatOrderClock,
  ordersInStage,
  primaryFloorAction,
  stageForStatus,
  statusLabel,
  type OrderBoardStage,
} from "@/lib/order-board";
import { downloadKitchenOrderTicketPdf, printKitchenOrderTicket } from "@/lib/kot-print";
import UpiPaymentQr from "@/components/shared/UpiPaymentQr";

async function captainRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const result = (await response.json()) as { success: boolean; data?: T; error?: string };
  if (!response.ok || !result.success) throw new Error(result.error ?? "Request failed");
  return result.data as T;
}

function pickBusyStage(orders: OrderSummary[]): OrderBoardStage {
  if (ordersInStage(orders, "new").length) return "new";
  if (ordersInStage(orders, "kitchen").length) return "kitchen";
  if (ordersInStage(orders, "ready").length) return "ready";
  return "done";
}

export default function CaptainOrders({
  initialOrders,
  restaurantName,
  upiSettings,
}: {
  initialOrders: OrderSummary[];
  restaurantName?: string;
  upiSettings?: { enabled: boolean; upiId: string; payeeName: string };
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [activeStage, setActiveStage] = useState<OrderBoardStage>(() => pickBusyStage(initialOrders));
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paymentModalOrder, setPaymentModalOrder] = useState<OrderSummary | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("CASH");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await captainRequest<OrderSummary[]>("/api/captain/orders");
      setOrders(next);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh orders");
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const stageCounts = useMemo(
    () =>
      Object.fromEntries(
        ORDER_BOARD_STAGES.map((stage) => [stage.id, ordersInStage(orders, stage.id).length]),
      ) as Record<OrderBoardStage, number>,
    [orders],
  );

  const list = ordersInStage(orders, activeStage);
  const stageMeta = ORDER_BOARD_STAGES.find((stage) => stage.id === activeStage)!;

  const setStatus = async (
    order: OrderSummary,
    status: OrderSummary["status"],
    options?: { printKot?: boolean },
  ) => {
    setBusyId(order.id);
    setMessage("");
    const previous = order;
    setOrders((current) => current.map((entry) => (entry.id === order.id ? { ...entry, status } : entry)));
    setActiveStage(stageForStatus(status));
    try {
      const updated = await captainRequest<OrderSummary>(`/api/captain/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setOrders((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      if (options?.printKot) printKitchenOrderTicket(updated, restaurantName);
      const nextStage = stageForStatus(updated.status);
      setActiveStage(nextStage);
      setMessage(`#${updated.orderNumber} → ${statusLabel(updated.status)}`);
      window.requestAnimationFrame(() => {
        document.getElementById(`captain-order-${updated.id}`)?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
        });
      });
    } catch (error) {
      setOrders((current) => current.map((entry) => (entry.id === previous.id ? previous : entry)));
      setActiveStage(stageForStatus(previous.status));
      setMessage(error instanceof Error ? error.message : "Unable to update order");
    } finally {
      setBusyId(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentModalOrder) return;
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const updated = await captainRequest<OrderSummary>(`/api/orders/${paymentModalOrder.id}/payment`, {
        method: "POST",
        body: JSON.stringify({ method: selectedMethod }),
      });
      setOrders((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setPaymentModalOrder(null);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-neutral-500">
            One step at a time — tap the next action on each ticket. No need to scroll the whole list.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-300 px-3 text-sm text-neutral-700"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </header>

      {/* Stage tabs — stay on one step instead of scrolling New → Kitchen → Ready */}
      <nav
        aria-label="Order workflow stages"
        className="sticky top-0 z-20 -mx-1 overflow-x-auto bg-[#f4f4f2]/95 px-1 py-2 backdrop-blur-md lg:static lg:bg-transparent lg:p-0 lg:backdrop-blur-none"
      >
        <div className="flex min-w-max gap-2 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm">
          {ORDER_BOARD_STAGES.map((stage) => {
            const count = stageCounts[stage.id];
            const active = activeStage === stage.id;
            if (stage.id === "done" && count === 0) return null;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setActiveStage(stage.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition ${
                  active
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {stage.title}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-neutral-900">{stageMeta.title}</p>
        <p className="text-xs text-neutral-500">{stageMeta.hint}</p>
      </div>

      {message ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {message}
        </p>
      ) : null}

      {!list.length ? (
        <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-12 text-center text-sm text-neutral-400">
          Nothing in {stageMeta.title.toLowerCase()} right now.
          {stageCounts.new + stageCounts.kitchen + stageCounts.ready > 0
            ? " Switch tabs above for other steps."
            : " New guest orders appear under New."}
        </p>
      ) : (
        <div className="space-y-3">
          {list.map((order) => {
            const action = primaryFloorAction(order.status);
            const isPaid = order.payment?.status === "PAID";
            const acceptToKitchen = order.status === "PENDING";
            const expanded = expandedIds.has(order.id) || order.items.length <= 3;
            const visibleItems = expanded ? order.items : order.items.slice(0, 3);
            const hiddenCount = order.items.length - visibleItems.length;

            return (
              <article
                id={`captain-order-${order.id}`}
                key={order.id}
                className="scroll-mt-24 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
              >
                {/* Header + primary action first — no scrolling past items */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 bg-neutral-50/80 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold">
                      #{order.orderNumber}
                      <span className="ml-2 text-sm font-semibold text-neutral-500">
                        Table {order.tableNumber}
                      </span>
                    </h3>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {formatOrderClock(order.createdAt)} · {statusLabel(order.status)}
                      {isPaid ? ` · Paid ${order.payment?.method}` : " · Unpaid"}
                    </p>
                    <p className="mt-1 text-base font-bold tabular-nums">₹{order.total}</p>
                  </div>

                  {action ? (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void setStatus(order, action.status, { printKot: acceptToKitchen })}
                      className="min-h-12 min-w-[10.5rem] rounded-2xl bg-neutral-900 px-4 text-sm font-bold text-white shadow-sm disabled:opacity-50"
                    >
                      {busyId === order.id ? "Updating…" : action.label}
                    </button>
                  ) : (
                    <span className="rounded-full bg-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600">
                      {statusLabel(order.status)}
                    </span>
                  )}
                </div>

                <div className="px-4 py-3 sm:px-5">
                  <ul className="space-y-2">
                    {visibleItems.map((item, index) => (
                      <li key={`${item.dishId}-${index}`} className="flex justify-between gap-3 text-sm">
                        <p className="font-medium text-neutral-800">
                          <span className="mr-2 inline-flex h-5 min-w-5 items-center justify-center rounded bg-neutral-100 px-1 text-[11px] font-bold">
                            {item.quantity}
                          </span>
                          {item.dishNameSnapshot}
                        </p>
                        <span className="shrink-0 text-neutral-500">₹{item.itemTotal}</span>
                      </li>
                    ))}
                  </ul>
                  {order.items.length > 3 ? (
                    <button
                      type="button"
                      onClick={() => toggleExpanded(order.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-900"
                    >
                      {expanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5" /> Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5" /> +{hiddenCount} more items
                        </>
                      )}
                    </button>
                  ) : null}

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                    {canReprintKot(order.status) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => printKitchenOrderTicket(order, restaurantName)}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-neutral-300 px-3 text-xs font-semibold text-neutral-700"
                        >
                          <Printer className="h-3.5 w-3.5" /> Print KOT
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadKitchenOrderTicketPdf(order, restaurantName)}
                          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-neutral-300 px-3 text-xs font-semibold text-neutral-700"
                        >
                          <Download className="h-3.5 w-3.5" /> Save PDF
                        </button>
                      </>
                    ) : null}
                    {order.status !== "CANCELLED" && !isPaid ? (
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentModalOrder(order);
                          setSelectedMethod("CASH");
                          setPaymentError("");
                        }}
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-xs font-semibold text-neutral-700"
                      >
                        Record payment
                      </button>
                    ) : null}
                    {canCancelOrder(order.status) ? (
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => void setStatus(order, "CANCELLED")}
                        className="h-10 rounded-xl border border-rose-200 px-3 text-xs font-semibold text-rose-600 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {paymentModalOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold">Record payment · #{paymentModalOrder.orderNumber}</h3>
            <p className="text-sm text-neutral-500">
              Table {paymentModalOrder.tableNumber} ·{" "}
              <strong className="text-neutral-900">₹{paymentModalOrder.total}</strong>
            </p>
            {paymentError ? <p className="text-xs text-rose-600">{paymentError}</p> : null}
            <div className="grid grid-cols-3 gap-2">
              {(["CASH", "UPI", "CARD"] as const).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setSelectedMethod(method)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold ${
                    selectedMethod === method
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
            {selectedMethod === "UPI" && upiSettings?.enabled && upiSettings.upiId ? (
              <UpiPaymentQr upiId={upiSettings.upiId} payeeName={upiSettings.payeeName} amount={paymentModalOrder.total} orderNumber={paymentModalOrder.orderNumber} compact />
            ) : selectedMethod === "UPI" ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">UPI QR is not configured for this restaurant.</p>
            ) : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={paymentBusy}
                onClick={() => setPaymentModalOrder(null)}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={paymentBusy}
                onClick={() => void handleRecordPayment()}
                className="rounded-xl bg-neutral-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {paymentBusy ? "Saving…" : `Confirm ₹${paymentModalOrder.total}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
