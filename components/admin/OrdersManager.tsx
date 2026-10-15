"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { OrderSummary } from "@/types";
import { Bell, BellOff, RefreshCw } from "lucide-react";

const nextAction: Partial<Record<OrderSummary["status"], { status: OrderSummary["status"]; label: string }>> = {
  PENDING: { status: "ACCEPTED", label: "Accept" },
  ACCEPTED: { status: "PREPARING", label: "Start preparing" },
  PREPARING: { status: "READY", label: "Mark ready" },
  READY: { status: "SERVED", label: "Mark served" },
};
const statusTitle: Record<OrderSummary["status"], string> = {
  PENDING: "New", ACCEPTED: "Accepted", PREPARING: "Preparing", READY: "Ready", SERVED: "Served", CANCELLED: "Cancelled",
};
const formatOrderTime = (iso: string) => `${iso.replace("T", " ").slice(0, 16)} UTC`;

function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;
    
    // First tone (E5 ~ 659 Hz)
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

    // Second tone (G#5 ~ 830 Hz)
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
    // If audio playback fails or is blocked by browser gesture policies, continue silently
  }
}

export default function OrdersManager({ initialOrders }: { initialOrders: OrderSummary[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [newOrderNotice, setNewOrderNotice] = useState<string | null>(null);
  const knownOrderIdsRef = useState(() => new Set(initialOrders.map((o) => o.id)))[0];

  const refresh = useCallback(async () => {
    try {
      const nextOrders = await api.getOrders();
      const freshPending = nextOrders.filter(
        (o) => o.status === "PENDING" && !knownOrderIdsRef.has(o.id),
      );

      if (freshPending.length > 0) {
        if (soundEnabled) {
          playNotificationChime();
        }
        setNewOrderNotice(
          `🔔 ${freshPending.length} new order${freshPending.length > 1 ? "s" : ""} received! Table ${freshPending.map((o) => o.tableNumber).join(", ")}`,
        );
      }

      for (const order of nextOrders) {
        knownOrderIdsRef.add(order.id);
      }

      setOrders(nextOrders);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh orders.");
    }
  }, [knownOrderIdsRef, soundEnabled]);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const setStatus = async (order: OrderSummary, status: OrderSummary["status"]) => {
    setBusyId(order.id); setMessage("");
    try {
      const updated = await api.updateOrderStatus(order.id, status);
      setOrders((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update order."); }
    finally { setBusyId(null); }
  };
  const [paymentModalOrder, setPaymentModalOrder] = useState<OrderSummary | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<import("@/types").PaymentMethod>("CASH");
  const [correctionModalOrder, setCorrectionModalOrder] = useState<OrderSummary | null>(null);
  const [correctionAction, setCorrectionAction] = useState<"CORRECTION" | "REVERSAL">("CORRECTION");
  const [correctionMethod, setCorrectionMethod] = useState<import("@/types").PaymentMethod>("UPI");
  const [correctionReason, setCorrectionReason] = useState("");
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentError, setPaymentError] = useState("");

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

  const renderPaymentBadge = (order: OrderSummary) => {
    const status = order.payment?.status ?? "NOT_RECORDED";
    if (status === "PAID") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          PAID · {order.payment?.method}
        </span>
      );
    }
    if (status === "UNPAID") {
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          UNPAID
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/50">
        NOT RECORDED
      </span>
    );
  };

  const groups: OrderSummary["status"][] = ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED"];
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Orders</h1>
          <p className="mt-1 text-sm text-white/55">New orders refresh automatically every 15 seconds.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm transition-colors ${
              soundEnabled
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                : "border-white/15 bg-white/5 text-white/50 hover:bg-white/10"
            }`}
            title={soundEnabled ? "Order chime active" : "Order chime muted"}
          >
            {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            <span>{soundEnabled ? "Chime On" : "Chime Muted"}</span>
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm text-white/80 hover:bg-white/10"
          >
            <RefreshCw className="h-4 w-4" />Refresh
          </button>
        </div>
      </header>

      {newOrderNotice && (
        <aside role="status" className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-4 text-sm font-semibold text-emerald-200 shadow-lg shadow-emerald-500/5">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
            </span>
            <span>{newOrderNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNewOrderNotice(null)}
            className="rounded-lg border border-emerald-400/30 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20"
          >
            Dismiss
          </button>
        </aside>
      )}

      {message && <p role="alert" className="text-sm text-rose-300">{message}</p>}

      {groups.map((status) => {
        const list = orders.filter((order) => order.status === status);
        if (!list.length) return null;
        return (
          <section key={status} className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white/55">
              {statusTitle[status]} <span className="text-white/30">{list.length}</span>
            </h2>
            {list.map((order) => {
              const action = nextAction[order.status];
              const isPaid = order.payment?.status === "PAID";
              return (
                <article id={`order-${order.id}`} key={order.id} className="scroll-mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        #{order.orderNumber} <span className="ml-1 text-sm font-medium text-white/60">· Table {order.tableNumber}</span>
                      </h3>
                      <p className="mt-1 text-xs text-white/40">{formatOrderTime(order.createdAt)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {renderPaymentBadge(order)}
                      <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">{statusTitle[status]}</span>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-3">
                    {order.items.map((item, index) => (
                      <li key={`${item.dishId}-${index}`} className="flex items-start justify-between gap-3 border-t border-white/8 pt-3 text-sm">
                        <div>
                          <p className="font-semibold text-white/90">{item.dishNameSnapshot} × {item.quantity}</p>
                          {item.addons.map((addon) => (
                            <p key={addon.addonId} className="mt-0.5 text-xs text-white/45">
                              {addon.nameSnapshot}{addon.quantity > 1 ? ` × ${addon.quantity}` : ""}
                            </p>
                          ))}
                        </div>
                        <span className="shrink-0 text-white/65">₹{item.itemTotal}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <div>
                      <p className="font-mono text-lg font-bold text-white">Total ₹{order.total}</p>
                      {order.payment?.recordedAt && (
                        <p className="text-[11px] text-white/45">
                          Paid at {formatOrderTime(order.payment.recordedAt)}
                          {order.payment.recordedBy?.name ? ` by ${order.payment.recordedBy.name}` : ""}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Payment Action */}
                      {status !== "CANCELLED" && !isPaid && (
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentModalOrder(order);
                            setSelectedMethod("CASH");
                            setPaymentError("");
                          }}
                          className="h-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20"
                        >
                          Record Payment
                        </button>
                      )}
                      {status !== "CANCELLED" && isPaid && (
                        <button
                          type="button"
                          onClick={() => {
                            setCorrectionModalOrder(order);
                            setCorrectionAction("CORRECTION");
                            setCorrectionMethod(order.payment?.method === "CASH" ? "UPI" : "CASH");
                            setCorrectionReason("");
                            setPaymentError("");
                          }}
                          className="h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-xs text-white/65 hover:bg-white/10"
                        >
                          Edit Payment
                        </button>
                      )}

                      {/* Order Kitchen Transition Actions */}
                      {(status === "PENDING" || status === "ACCEPTED") && (
                        <button
                          disabled={busyId === order.id}
                          onClick={() => void setStatus(order, "CANCELLED")}
                          className="h-10 rounded-xl border border-rose-400/30 px-4 text-sm font-semibold text-rose-200 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                      {action && (
                        <button
                          disabled={busyId === order.id}
                          onClick={() => void setStatus(order, action.status)}
                          className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-black disabled:opacity-50"
                        >
                          {action.label}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        );
      })}

      {orders.length === 0 && (
        <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-white/45">
          No orders yet.
        </p>
      )}

      {/* Record Payment Modal */}
      {paymentModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/15 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              Record Payment · #{paymentModalOrder.orderNumber}
            </h3>
            <p className="text-sm text-white/60">
              Table {paymentModalOrder.tableNumber} · Authoritative Amount:{" "}
              <strong className="text-white">₹{paymentModalOrder.total}</strong>
            </p>
            {paymentError && <p className="text-xs text-rose-400">{paymentError}</p>}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/70">Payment Method</label>
              <div className="grid grid-cols-3 gap-2">
                {(["CASH", "UPI", "CARD"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSelectedMethod(m)}
                    className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                      selectedMethod === m
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={paymentBusy}
                onClick={() => setPaymentModalOrder(null)}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={paymentBusy}
                onClick={() => void handleRecordPayment()}
                className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-bold text-black hover:bg-emerald-400 disabled:opacity-50"
              >
                {paymentBusy ? "Recording..." : `Confirm ₹${paymentModalOrder.total}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Payment Correction Modal */}
      {correctionModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md space-y-4 rounded-2xl border border-white/15 bg-zinc-900 p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">
              Edit Payment · #{correctionModalOrder.orderNumber}
            </h3>
            <p className="text-xs text-white/55">
              Current: <strong className="text-emerald-300">PAID via {correctionModalOrder.payment?.method}</strong> (₹{correctionModalOrder.total})
            </p>
            {paymentError && <p className="text-xs text-rose-400">{paymentError}</p>}
            <div className="space-y-2">
              <label className="text-xs font-medium text-white/70">Action</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectionAction("CORRECTION")}
                  className={`rounded-xl border py-2 text-xs font-semibold ${
                    correctionAction === "CORRECTION"
                      ? "border-sky-500 bg-sky-500/20 text-sky-300"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  Change Method
                </button>
                <button
                  type="button"
                  onClick={() => setCorrectionAction("REVERSAL")}
                  className={`rounded-xl border py-2 text-xs font-semibold ${
                    correctionAction === "REVERSAL"
                      ? "border-rose-500 bg-rose-500/20 text-rose-300"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  Reverse to Unpaid
                </button>
              </div>
            </div>

            {correctionAction === "CORRECTION" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-white/70">New Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["CASH", "UPI", "CARD"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setCorrectionMethod(m)}
                      className={`rounded-xl border py-2 text-xs font-semibold ${
                        correctionMethod === m
                          ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                          : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-white/70">Audit Reason (Mandatory)</label>
              <input
                type="text"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="e.g. Diner changed settlement method to UPI"
                className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={paymentBusy}
                onClick={() => setCorrectionModalOrder(null)}
                className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white/70 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={paymentBusy}
                onClick={() => void handleCorrectPayment()}
                className={`rounded-xl px-5 py-2 text-sm font-bold text-black disabled:opacity-50 ${
                  correctionAction === "REVERSAL" ? "bg-rose-400 hover:bg-rose-300" : "bg-sky-400 hover:bg-sky-300"
                }`}
              >
                {paymentBusy ? "Saving..." : "Apply Modification"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
