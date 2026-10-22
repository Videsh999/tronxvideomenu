"use client";

import { useCallback, useEffect, useState } from "react";
import type { OrderSummary, PaymentMethod } from "@/types";
import { Printer, RefreshCw } from "lucide-react";
import {
  ORDER_BOARD_STAGES,
  canCancelOrder,
  canReprintKot,
  formatOrderClock,
  ordersInStage,
  primaryFloorAction,
  statusLabel,
} from "@/lib/order-board";
import { printKitchenOrderTicket } from "@/lib/kot-print";

async function captainRequest<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const result = await response.json() as { success: boolean; data?: T; error?: string };
  if (!response.ok || !result.success) throw new Error(result.error ?? "Request failed");
  return result.data as T;
}

export default function CaptainOrders({
  initialOrders,
  restaurantName,
}: {
  initialOrders: OrderSummary[];
  restaurantName?: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [paymentModalOrder, setPaymentModalOrder] = useState<OrderSummary | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("CASH");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const refresh = useCallback(async () => {
    try {
      setOrders(await captainRequest<OrderSummary[]>("/api/captain/orders"));
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh orders");
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const setStatus = async (order: OrderSummary, status: OrderSummary["status"], options?: { printKot?: boolean }) => {
    setBusyId(order.id);
    setMessage("");
    try {
      const updated = await captainRequest<OrderSummary>(`/api/captain/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setOrders((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      if (options?.printKot) printKitchenOrderTicket(updated, restaurantName);
    } catch (error) {
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

  const newCount = ordersInStage(orders, "new").length;
  const kitchenCount = ordersInStage(orders, "kitchen").length;
  const readyCount = ordersInStage(orders, "ready").length;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Accept → kitchen ticket prints → cook → ready → serve. Updates every 10 seconds.
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

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "New", value: newCount },
          { label: "Kitchen", value: kitchenCount },
          { label: "Ready", value: readyCount },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-center sm:px-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{stat.value}</p>
          </div>
        ))}
      </div>

      {message ? <p role="alert" className="text-sm text-rose-600">{message}</p> : null}

      {ORDER_BOARD_STAGES.map((stage) => {
        const list = ordersInStage(orders, stage.id);
        if (!list.length && stage.id === "done") return null;
        return (
          <section key={stage.id} className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-neutral-500">
                  {stage.title} · {list.length}
                </h2>
                <p className="text-xs text-neutral-400">{stage.hint}</p>
              </div>
            </div>

            {!list.length ? (
              <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-8 text-center text-sm text-neutral-400">
                Nothing here right now.
              </p>
            ) : (
              list.map((order) => {
                const action = primaryFloorAction(order.status);
                const isPaid = order.payment?.status === "PAID";
                const acceptToKitchen = order.status === "PENDING";
                return (
                  <article key={order.id} className="rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold">
                          #{order.orderNumber}
                          <span className="ml-2 text-sm font-semibold text-neutral-500">Table {order.tableNumber}</span>
                        </h3>
                        <p className="mt-1 text-xs text-neutral-400">{formatOrderClock(order.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {isPaid ? (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Paid · {order.payment?.method}
                          </span>
                        ) : order.status !== "CANCELLED" ? (
                          <span className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-500">
                            Unpaid
                          </span>
                        ) : null}
                        <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-semibold text-white">
                          {statusLabel(order.status)}
                        </span>
                      </div>
                    </div>

                    <ul className="mt-4 space-y-3">
                      {order.items.map((item, index) => (
                        <li key={`${item.dishId}-${index}`} className="flex justify-between gap-3 border-t border-neutral-100 pt-3 text-sm">
                          <div>
                            <p className="font-semibold">
                              <span className="mr-2 inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-neutral-100 px-1.5 text-xs font-bold">
                                {item.quantity}
                              </span>
                              {item.dishNameSnapshot}
                            </p>
                            {item.addons.map((addon) => (
                              <p key={addon.addonId} className="mt-0.5 pl-8 text-xs text-neutral-500">
                                + {addon.nameSnapshot}
                                {addon.quantity > 1 ? ` × ${addon.quantity}` : ""}
                              </p>
                            ))}
                          </div>
                          <span className="shrink-0 text-neutral-600">₹{item.itemTotal}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-4">
                      <p className="text-lg font-bold">Total ₹{order.total}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        {canReprintKot(order.status) ? (
                          <button
                            type="button"
                            onClick={() => printKitchenOrderTicket(order, restaurantName)}
                            className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-neutral-300 px-3.5 text-sm font-semibold text-neutral-700"
                          >
                            <Printer className="h-4 w-4" /> Print KOT
                          </button>
                        ) : null}
                        {order.status !== "CANCELLED" && !isPaid ? (
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentModalOrder(order);
                              setSelectedMethod("CASH");
                              setPaymentError("");
                            }}
                            className="h-11 rounded-xl border border-neutral-300 px-3.5 text-sm font-semibold text-neutral-700"
                          >
                            Record payment
                          </button>
                        ) : null}
                        {canCancelOrder(order.status) ? (
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() => void setStatus(order, "CANCELLED")}
                            className="h-11 rounded-xl border border-rose-200 px-4 text-sm font-semibold text-rose-600 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ) : null}
                        {action ? (
                          <button
                            type="button"
                            disabled={busyId === order.id}
                            onClick={() => void setStatus(order, action.status, { printKot: acceptToKitchen })}
                            className="h-11 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white disabled:opacity-50"
                          >
                            {busyId === order.id ? "Updating…" : action.label}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        );
      })}

      {!orders.length ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          No orders yet. When a guest places one, it appears under New.
        </p>
      ) : null}

      {paymentModalOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold">Record payment · #{paymentModalOrder.orderNumber}</h3>
            <p className="text-sm text-neutral-500">
              Table {paymentModalOrder.tableNumber} · <strong className="text-neutral-900">₹{paymentModalOrder.total}</strong>
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
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={paymentBusy} onClick={() => setPaymentModalOrder(null)} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
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
