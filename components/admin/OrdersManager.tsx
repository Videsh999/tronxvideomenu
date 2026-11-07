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
  stageForStatus,
  statusLabel,
  type OrderBoardStage,
} from "@/lib/order-board";
import { printKitchenOrderTicket } from "@/lib/kot-print";
import { orderLocationName } from "@/lib/service-location";

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
  const [activeStage, setActiveStage] = useState<OrderBoardStage>(() => {
    if (ordersInStage(initialOrders, "new").length) return "new";
    if (ordersInStage(initialOrders, "kitchen").length) return "kitchen";
    if (ordersInStage(initialOrders, "ready").length) return "ready";
    return "done";
  });
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
  const [lineCancelOrder, setLineCancelOrder] = useState<OrderSummary | null>(null);
  const [lineCancelQty, setLineCancelQty] = useState<Record<string, number>>({});
  const [lineCancelReason, setLineCancelReason] = useState("");
  const [lineCancelConfirm, setLineCancelConfirm] = useState(false);
  const [lineCancelBusy, setLineCancelBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const nextOrders = await api.getOrders();
      const freshPending = nextOrders.filter((order) => order.status === "PENDING" && !knownOrderIdsRef.has(order.id));
      if (freshPending.length > 0) {
        if (soundEnabled) playNotificationChime();
        setActiveStage("new");
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
    const previous = order;
    setOrders((current) => current.map((entry) => (entry.id === order.id ? { ...entry, status } : entry)));
    setActiveStage(stageForStatus(status));
    try {
      const updated = await api.updateOrderStatus(order.id, status);
      setOrders((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      if (options?.printKot) printKitchenOrderTicket(updated, restaurantName);
      setActiveStage(stageForStatus(updated.status));
      window.requestAnimationFrame(() => {
        document.getElementById(`order-${updated.id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    } catch (error) {
      setOrders((current) => current.map((entry) => (entry.id === previous.id ? previous : entry)));
      setActiveStage(stageForStatus(previous.status));
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
  const doneCount = ordersInStage(orders, "done").length;
  const stageList = ordersInStage(orders, activeStage);
  const stageMeta = ORDER_BOARD_STAGES.find((stage) => stage.id === activeStage)!;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-neutral-500">
            One step at a time — next action sits on top of each ticket. Refreshes every 10 seconds.
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

      <nav aria-label="Order workflow stages" className="sticky top-0 z-20 -mx-1 overflow-x-auto bg-[#f7f7f5]/95 px-1 py-2 backdrop-blur-md">
        <div className="flex min-w-max gap-2 rounded-2xl border border-neutral-200 bg-white p-1.5 shadow-sm">
          {(
            [
              { id: "new" as const, count: newCount },
              { id: "kitchen" as const, count: kitchenCount },
              { id: "ready" as const, count: readyCount },
              { id: "done" as const, count: doneCount },
            ] as const
          ).map((tab) => {
            if (tab.id === "done" && tab.count === 0) return null;
            const active = activeStage === tab.id;
            const title = ORDER_BOARD_STAGES.find((stage) => stage.id === tab.id)!.title;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveStage(tab.id)}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition ${
                  active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {title}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-700"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {newOrderNotice ? (
        <aside role="status" className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900">
          <span>{newOrderNotice}</span>
          <button
            type="button"
            onClick={() => {
              setNewOrderNotice(null);
              setActiveStage("new");
            }}
            className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs"
          >
            Open New
          </button>
        </aside>
      ) : null}

      {message ? <p role="alert" className="text-sm text-rose-600">{message}</p> : null}

      <div className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
        <p className="text-sm font-semibold text-neutral-900">{stageMeta.title}</p>
        <p className="text-xs text-neutral-500">{stageMeta.hint}</p>
      </div>

      {!orders.length ? (
        <p className="rounded-2xl border border-dashed border-neutral-300 p-10 text-center text-sm text-neutral-500">
          No orders yet.
        </p>
      ) : !stageList.length ? (
        <p className="rounded-2xl border border-dashed border-neutral-200 px-4 py-12 text-center text-sm text-neutral-400">
          Nothing in {stageMeta.title.toLowerCase()} right now. Switch tabs for other steps.
        </p>
      ) : (
        <div className="space-y-3">
          {stageList.map((order) => {
            const action = primaryFloorAction(order.status);
            const isPaid = order.payment?.status === "PAID";
            const acceptToKitchen = order.status === "PENDING";
            return (
              <article
                id={`order-${order.id}`}
                key={order.id}
                className="scroll-mt-24 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 bg-neutral-50/80 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-neutral-900">
                      #{order.orderNumber}
                      <span className="ml-2 text-sm font-semibold text-neutral-500">{orderLocationName(order)}</span>
                    </h3>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {formatOrderClock(order.createdAt)} · {statusLabel(order.status)}
                      {isPaid ? ` · Paid ${order.payment?.method}` : " · Unpaid"}
                    </p>
                    <p className="mt-1 font-mono text-base font-bold tabular-nums text-neutral-900">₹{order.total}</p>
                  </div>
                  {action ? (
                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => void setStatus(order, action.status, { printKot: acceptToKitchen })}
                      className="min-h-12 min-w-[10.5rem] rounded-2xl bg-neutral-900 px-4 text-sm font-bold text-white disabled:opacity-50"
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
                    {order.items.map((item, index) => (
                      <li key={`${item.dishId}-${index}`} className="flex items-start justify-between gap-3 text-sm">
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

                  <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
                    {canReprintKot(order.status) ? (
                      <button
                        type="button"
                        onClick={() => printKitchenOrderTicket(order, restaurantName)}
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-neutral-300 px-3 text-xs font-semibold text-neutral-700"
                      >
                        <Printer className="h-3.5 w-3.5" /> Print KOT
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
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-xs font-semibold text-neutral-700"
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
                        className="h-10 rounded-xl border border-neutral-300 px-3 text-xs text-neutral-600"
                      >
                        Edit payment
                      </button>
                    ) : null}
                    {canCancelOrder(order.status) || ["ACCEPTED", "PREPARING"].includes(order.status) ? (
                      <button
                        type="button"
                        disabled={busyId === order.id}
                        onClick={() => {
                          setLineCancelOrder(order);
                          setLineCancelQty({});
                          setLineCancelReason("");
                          setLineCancelConfirm(false);
                          setPaymentError("");
                        }}
                        className="h-10 rounded-xl border border-amber-200 px-3 text-xs font-semibold text-amber-800 disabled:opacity-50"
                      >
                        Cancel lines
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
              {orderLocationName(paymentModalOrder)} · <strong className="text-neutral-900">₹{paymentModalOrder.total}</strong>
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

      {lineCancelOrder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-semibold text-neutral-900">
              Cancel lines · Order #{lineCancelOrder.orderNumber}
            </h3>
            <p className="text-xs text-neutral-500">
              Only queued lines can be cancelled. Prepared or ready items are blocked. Inventory restores only for eligible unprepared quantities.
            </p>
            <ul className="max-h-56 space-y-2 overflow-y-auto">
              {lineCancelOrder.items.map((item) => {
                const lineId = item.lineId ?? "";
                const cancelled = item.cancelledQuantity ?? 0;
                const remaining = item.quantity - cancelled;
                const blocked =
                  item.preparationStatus === "PREPARING" || item.preparationStatus === "READY";
                if (!lineId || remaining < 1) return null;
                return (
                  <li key={lineId} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium text-neutral-900">{item.dishNameSnapshot}</div>
                      <div className="text-xs text-neutral-500">
                        Remaining {remaining}
                        {blocked ? " · in prep (blocked)" : ""}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      disabled={blocked || lineCancelBusy}
                      value={lineCancelQty[lineId] ?? 0}
                      onChange={(event) =>
                        setLineCancelQty((current) => ({
                          ...current,
                          [lineId]: Math.max(0, Math.min(remaining, Number(event.target.value) || 0)),
                        }))
                      }
                      className="h-10 w-20 rounded-lg border border-neutral-300 px-2 text-sm"
                    />
                  </li>
                );
              })}
            </ul>
            <input
              type="text"
              value={lineCancelReason}
              onChange={(event) => setLineCancelReason(event.target.value)}
              placeholder="Cancellation reason (required)"
              className="w-full rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm text-rose-700">
              <input
                type="checkbox"
                checked={lineCancelConfirm}
                onChange={(event) => setLineCancelConfirm(event.target.checked)}
              />
              Confirm cancellation
            </label>
            {paymentError ? <p className="text-sm text-rose-600">{paymentError}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={lineCancelBusy}
                onClick={() => setLineCancelOrder(null)}
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm"
              >
                Close
              </button>
              <button
                type="button"
                disabled={lineCancelBusy || !lineCancelConfirm}
                onClick={() => {
                  void (async () => {
                    if (!lineCancelOrder) return;
                    const lines = Object.entries(lineCancelQty)
                      .filter(([, quantity]) => quantity > 0)
                      .map(([lineId, quantity]) => ({ lineId, quantity }));
                    if (!lines.length) {
                      setPaymentError("Select at least one quantity to cancel.");
                      return;
                    }
                    if (lineCancelReason.trim().length < 3) {
                      setPaymentError("Enter a cancellation reason.");
                      return;
                    }
                    setLineCancelBusy(true);
                    setPaymentError("");
                    try {
                      const result = await api.cancelOrderLines(lineCancelOrder.id, {
                        lines,
                        reason: lineCancelReason.trim(),
                        idempotencyKey: `ui-cancel-${lineCancelOrder.id}-${Date.now()}`,
                        confirm: true,
                      });
                      setOrders((current) =>
                        current.map((entry) => (entry.id === result.order.id ? result.order : entry)),
                      );
                      setMessage(
                        result.refundSuggested > 0
                          ? `Lines cancelled. Suggested refund ${result.refundSuggested}.`
                          : "Lines cancelled.",
                      );
                      setLineCancelOrder(null);
                    } catch (error) {
                      setPaymentError(error instanceof Error ? error.message : "Unable to cancel lines.");
                    } finally {
                      setLineCancelBusy(false);
                    }
                  })();
                }}
                className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {lineCancelBusy ? "Cancelling…" : "Cancel selected"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
