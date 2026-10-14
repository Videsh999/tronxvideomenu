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
  const groups: OrderSummary["status"][] = ["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED"];
  return <div className="space-y-6">
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
        <button type="button" onClick={() => void refresh()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm text-white/80 hover:bg-white/10"><RefreshCw className="h-4 w-4" />Refresh</button>
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
      return <section key={status} className="space-y-3"><h2 className="text-sm font-bold uppercase tracking-[0.18em] text-white/55">{statusTitle[status]} <span className="text-white/30">{list.length}</span></h2>
        {list.map((order) => {
          const action = nextAction[order.status];
          return <article id={`order-${order.id}`} key={order.id} className="scroll-mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-white">#{order.orderNumber} <span className="ml-1 text-sm font-medium text-white/60">· Table {order.tableNumber}</span></h3><p className="mt-1 text-xs text-white/40">{formatOrderTime(order.createdAt)}</p></div><span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">{statusTitle[status]}</span></div>
            <ul className="mt-4 space-y-3">{order.items.map((item, index) => <li key={`${item.dishId}-${index}`} className="flex items-start justify-between gap-3 border-t border-white/8 pt-3 text-sm"><div><p className="font-semibold text-white/90">{item.dishNameSnapshot} × {item.quantity}</p>{item.addons.map((addon) => <p key={addon.addonId} className="mt-0.5 text-xs text-white/45">{addon.nameSnapshot}{addon.quantity > 1 ? ` × ${addon.quantity}` : ""}</p>)}</div><span className="shrink-0 text-white/65">₹{item.itemTotal}</span></li>)}</ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"><p className="font-mono text-lg font-bold text-white">Total ₹{order.total}</p><div className="flex gap-2">{(status === "PENDING" || status === "ACCEPTED") && <button disabled={busyId === order.id} onClick={() => void setStatus(order, "CANCELLED")} className="h-10 rounded-xl border border-rose-400/30 px-4 text-sm font-semibold text-rose-200 disabled:opacity-50">Cancel</button>}{action && <button disabled={busyId === order.id} onClick={() => void setStatus(order, action.status)} className="h-10 rounded-xl bg-white px-4 text-sm font-bold text-black disabled:opacity-50">{action.label}</button>}</div></div>
          </article>;
        })}
      </section>;
    })}
    {orders.length === 0 && <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-white/45">No orders yet.</p>}
  </div>;
}
