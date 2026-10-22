"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OrderSummary, PaymentMethod } from "@/types";
import { Bell, BellOff, Printer, RefreshCw } from "lucide-react";
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

function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(830.61, now + 0.12);
    gain2.gain.setValueAtTime(0.2, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch {
    /* ignore blocked audio */
  }
}

export default function OrdersManager({
  initialOrders,
  restaurantName,
}: {
  initialOrders: OrderSummary[];
  restaurantName?: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderNotice, setNewOrderNotice] = useState<string | null>(null);
  const knownOrderIdsRef = useState(() => new Set(initialOrders.map((order) => order.id)))[0];
  const [paymentModalOrder, setPaymentModalOrder] = useState<OrderSummary | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("CASH");
  const [correctionModalOrder, setCorrectionModalOrder] = useState<OrderSummary | null>(null);
  const [correctionAction, setCorrectionAction] = useState<"CORRECTION" | "REVERSAL">("CORRECTION");
  const [correctionMethod, setCorrectionMethod] = useState<PaymentMethod>("UPI");
  const [correctionReason, setCorrectionReason] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const nextOrders = await api.getOrders();
      const freshPending = nextOrders.filter((order) => order.status === "PENDING" && !knownOrderIdsRef.has(order.id));
      if (freshPending.length > 0) {
        if (soundEnabled) playNotificationChime();
        setNewOrderNotice(
          `${freshPending.length} new order${freshPending.length > 1 ? "s" : ""} · Table ${freshPending.map((order) => order.tableNumber).join(", ")}`,
        );
      }
      for (const order of nextOrders) knownOrderIdsRef.add(order.id);
      setOrders(nextOrders);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh orders.");
    }
  }, [knownOrderIdsRef, soundEnabled]);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 10000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const setStatus = async (order: OrderSummary, status: OrderSummary["status"], options?: { printKot?: boolean }) => {
    setBusyId(order.id);
    setMessage("");
    try {
      const updated = await api.updateOrderStatus(order.id, status);
      setOrders((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      if (options?.printKot) printKitchenOrderTicket(updated, restaurantName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update order.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentModalOrder) return;
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const updated = await api.recordPayment(paymentModalOrder.id, selectedMethod);
      setOrders((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setPaymentModalOrder(null);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setPaymentBusy(false);
    }
  };

  const handleCorrectPayment = async () => {
    if (!correctionModalOrder) return;
    if (!correctionReason.trim() || correctionReason.trim().length < 5) {
      setPaymentError("A reason of at least 5 characters is required.");
      return;
    }
    setPaymentBusy(true);
    setPaymentError("");
    try {
      const updated = await api.correctPayment(correctionModalOrder.id, {
        action: correctionAction,
        method: correctionAction === "CORRECTION" ? correctionMethod : undefined,
        reason: correctionReason.trim(),
      });
      setOrders((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setCorrectionModalOrder(null);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to modify payment.");
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
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Clear path: New → Kitchen (KOT prints) → Ready → Served. Refreshes every 10 seconds.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm ${
              soundEnabled
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-300 bg-white text-neutral-500"
            }`}
          >
            {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            {soundEnabled ? "Chime on" : "Chime off"}
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-neutral-300 px-3 text-sm text-neutral-700 hover:bg-neutral-100"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "New", value: newCount },
          { label: "Kitchen", value: kitchenCount },
          { label: "Ready", value: readyCount },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-neutral-200 bg-white px-3 py-3 text-center sm:px-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-neutral-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {newOrderNotice ? (
        <aside role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900">
          <span>{newOrderNotice}</span>
          <button type="button" onClick={() => setNewOrderNotice(null)} className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs">
            Dismiss
          </button>
        </aside>
      ) : null}

      {message ? <p role="alert" className="text-sm text-rose-600">{message}</p> : null}

      {ORDER_BOARD_STAGES.map((stage) => {
        const list = ordersInStage(orders, stage.id);
        if (!list.length && stage.id === "done") return null;
        return (
          <section key={stage.id} className="space-y-3">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-neutral-500">
                {stage.title} · {list.length}
              </h2>
              <p className="text-xs text-neutral-400">{stage.hint}</p>
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
                  <article id={`order-${order.id}`} key={order.id} className="scroll-mt-6 rounded-2xl border border-neutral-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-neutral-900">
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
                        <li key={`${item.dishId}-${index}`} className="flex items-start justify-between gap-3 border-t border-neutral-100 pt-3 text-sm">
                          <div>
                            <p className="font-semibold text-neutral-900">
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
                      <div>
                        <p className="font-mono text-lg font-bold text-neutral-900">Total ₹{order.total}</p>
                        {order.payment?.recordedAt ? (
                          <p className="text-[11px] text-neutral-500">
                            Paid {formatOrderClock(order.payment.recordedAt)}
                            {order.payment.recordedBy?.name ? ` by ${order.payment.recordedBy.name}` : ""}
                          </p>
                        ) : null}
                      </div>
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
                        {order.status !== "CANCELLED" && isPaid ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCorrectionModalOrder(order);
                              setCorrectionAction("CORRECTION");
                              setCorrectionMethod(order.payment?.method === "CASH" ? "UPI" : "CASH");
                              setCorrectionReason("");
                              setPaymentError("");
                            }}
                            className="h-11 rounded-xl border border-neutral-300 px-3 text-sm text-neutral-600"
                          >
                            Edit payment
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
          No orders yet.
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
                    selectedMethod === method ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-700"
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
              <button type="button" disabled={paymentBusy} onClick={() => void handleRecordPayment()} className="rounded-xl bg-neutral-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                {paymentBusy ? "Saving…" : `Confirm ₹${paymentModalOrder.total}`}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {correctionModalOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold">Edit payment · #{correctionModalOrder.orderNumber}</h3>
            <p className="text-xs text-neutral-500">
              Current: <strong>Paid via {correctionModalOrder.payment?.method}</strong> (₹{correctionModalOrder.total})
            </p>
            {paymentError ? <p className="text-xs text-rose-600">{paymentError}</p> : null}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCorrectionAction("CORRECTION")}
                className={`rounded-xl border py-2 text-xs font-semibold ${correctionAction === "CORRECTION" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200"}`}
              >
                Change method
              </button>
              <button
                type="button"
                onClick={() => setCorrectionAction("REVERSAL")}
                className={`rounded-xl border py-2 text-xs font-semibold ${correctionAction === "REVERSAL" ? "border-rose-600 bg-rose-600 text-white" : "border-neutral-200"}`}
              >
                Reverse to unpaid
              </button>
            </div>
            {correctionAction === "CORRECTION" ? (
              <div className="grid grid-cols-3 gap-2">
                {(["CASH", "UPI", "CARD"] as const).map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setCorrectionMethod(method)}
                    className={`rounded-xl border py-2 text-xs font-semibold ${correctionMethod === method ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200"}`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            ) : null}
            <input
              type="text"
              value={correctionReason}
              onChange={(event) => setCorrectionReason(event.target.value)}
              placeholder="Reason (required)"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={paymentBusy} onClick={() => setCorrectionModalOrder(null)} className="rounded-xl border border-neutral-300 px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="button" disabled={paymentBusy} onClick={() => void handleCorrectPayment()} className="rounded-xl bg-neutral-900 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                {paymentBusy ? "Saving…" : "Apply"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
