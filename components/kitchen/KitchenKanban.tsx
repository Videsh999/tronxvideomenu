"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Maximize2, Minimize2, RefreshCw, Volume2, VolumeX } from "lucide-react";
import type { KitchenStation, OrderStatus, OrderSummary } from "@/types";
import {
  KITCHEN_COLUMNS,
  KITCHEN_STATIONS,
  filterOrdersByStation,
  formatTicketTimer,
  ordersInKitchenColumn,
  ticketUrgency,
} from "@/lib/kitchen-board";
import { printKitchenOrderTicket } from "@/lib/kot-print";

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = 880;
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch {
    /* ignore */
  }
}

type Props = {
  restaurantName: string;
  initialOrders: OrderSummary[];
  /** Poll endpoint returning `{ success, data: OrderSummary[] }` */
  pollUrl: string;
  /** PATCH body `{ status }` to move a ticket */
  statusUrl: (orderId: string) => string;
  itemStatusUrl?: (orderId: string) => string;
  pollMs?: number;
};

export default function KitchenKanban({
  restaurantName,
  initialOrders,
  pollUrl,
  statusUrl,
  itemStatusUrl = (orderId) => `/api/kitchen/orders/${orderId}/items`,
  pollMs = 5000,
}: Props) {
  const [orders, setOrders] = useState(initialOrders);
  const [station, setStation] = useState<KitchenStation | "ALL">("ALL");
  const [soundOn, setSoundOn] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState(() => new Date());
  const [now, setNow] = useState(() => Date.now());
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const knownIds = useRef(new Set(initialOrders.map((order) => order.id)));
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const query = station === "ALL" ? "" : `${pollUrl.includes("?") ? "&" : "?"}station=${station}`;
    // station filtering is client-side too; server may ignore unknown query
    const url = pollUrl.includes("station=") ? pollUrl : `${pollUrl}${query}`;
    const response = await fetch(url, { cache: "no-store" });
    const json = await response.json();
    if (!json.success) throw new Error(json.error || "Unable to refresh kitchen");
    const next: OrderSummary[] = json.data;
    const fresh = next.filter((order) => !knownIds.current.has(order.id));
    if (fresh.length > 0 && soundOn) playChime();
    knownIds.current = new Set(next.map((order) => order.id));
    setOrders(next);
    setSyncedAt(new Date());
    setError(null);
  }, [pollUrl, soundOn, station]);

  useEffect(() => {
    const poll = window.setInterval(() => {
      void load().catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Connection issue");
      });
    }, pollMs);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [load, pollMs]);

  useEffect(() => {
    void load().catch(() => null);
  }, [load]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const visible = useMemo(() => filterOrdersByStation(orders, station), [orders, station]);

  function moveOrder(order: OrderSummary, status: OrderStatus) {
    setBusyId(order.id);
    const previous = order;
    // Optimistic: ticket jumps columns immediately; server confirms in background.
    setOrders((current) =>
      current.map((entry) => (entry.id === order.id ? { ...entry, status } : entry)),
    );
    startTransition(async () => {
      setError(null);
      try {
        const response = await fetch(statusUrl(order.id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Unable to move ticket");
        const updated: OrderSummary = json.data;
        setOrders((current) => {
          const next = current.map((entry) => (entry.id === updated.id ? updated : entry));
          // Drop completed/cancelled; keep served briefly if still in payload
          if (!["ACCEPTED", "PREPARING", "READY", "SERVED"].includes(updated.status)) {
            return next.filter((entry) => entry.id !== updated.id);
          }
          return next;
        });
      } catch (cause) {
        setOrders((current) =>
          current.map((entry) => (entry.id === previous.id ? previous : entry)),
        );
        setError(cause instanceof Error ? cause.message : "Unable to move ticket");
      } finally {
        setBusyId(null);
      }
    });
  }

  function setItemStatus(orderId: string, lineId: string, preparationStatus: "PREPARING" | "READY") {
    startTransition(async () => {
      try {
        const response = await fetch(itemStatusUrl(orderId), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, preparationStatus }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Item update failed");
        setOrders((current) => current.map((order) => (order.id === json.data.id ? json.data : order)));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Item update failed");
      }
    });
  }

  function toggleFullscreen() {
    if (!rootRef.current) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current.requestFullscreen();
  }

  return (
    <div
      ref={rootRef}
      className="flex min-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#0c0b0a] text-[#f6f1ea] shadow-2xl lg:min-h-[calc(100dvh-6rem)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#c4a574]">Kitchen display</p>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Live tickets · {restaurantName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={station}
            onChange={(event) => setStation(event.target.value as KitchenStation | "ALL")}
            className="min-h-10 rounded-xl border border-white/15 bg-white/5 px-3 text-sm"
          >
            {KITCHEN_STATIONS.map((entry) => (
              <option key={entry.id} value={entry.id} className="bg-[#1a1816] text-white">
                {entry.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                try {
                  await load();
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : "Refresh failed");
                }
              })
            }
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/10 px-3 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" /> Sync
          </button>
          <button
            type="button"
            onClick={() => setSoundOn((value) => !value)}
            className="grid min-h-10 min-w-10 place-items-center rounded-xl bg-white/10"
            aria-label={soundOn ? "Mute" : "Unmute"}
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="grid min-h-10 min-w-10 place-items-center rounded-xl bg-white/10"
            aria-label="Fullscreen"
          >
            {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-300">
            Synced {syncedAt.toLocaleTimeString()}
          </span>
        </div>
      </header>

      {error ? (
        <p className="bg-[#5c241c] px-4 py-2 text-sm text-[#ffd7cf]">{error}</p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 overflow-x-auto p-3 sm:p-4 lg:grid-cols-4">
        {KITCHEN_COLUMNS.map((column) => {
          const list = ordersInKitchenColumn(visible, column.id);
          return (
            <section
              key={column.id}
              className="flex min-h-[22rem] min-w-[16.5rem] flex-col rounded-2xl border border-white/10 bg-[#141210]/90 lg:min-h-0 lg:min-w-0"
            >
              <div className="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: column.accent }} />
                  <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-[#d9cfc0]">
                    {column.title}
                  </h2>
                </div>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold tabular-nums">
                  {list.length}
                </span>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2.5">
                {list.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-white/10 px-3 py-10 text-center text-sm text-[#7d7368]">
                    Nothing here yet.
                  </p>
                ) : (
                  list.map((order) => {
                    const urgency = ticketUrgency(order.createdAt, now);
                    const timer = formatTicketTimer(order.createdAt, now);
                    const columnMeta = KITCHEN_COLUMNS.find((entry) =>
                      entry.statuses.includes(order.status),
                    )!;
                    return (
                      <article
                        key={order.id}
                        className={`overflow-hidden rounded-2xl border bg-[#1b1815] shadow-lg ${
                          urgency === "late"
                            ? "border-[#e35d4a]"
                            : urgency === "watch"
                              ? "border-[#e7c27d]"
                              : "border-[#e7c27d]/55"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2 border-b border-white/5 px-3 pt-3">
                          <div>
                            <p className="text-2xl font-black tracking-tight">#{order.orderNumber}</p>
                            <p className="mt-0.5 text-sm text-[#b9a792]">
                              {order.tableNumber > 0 ? `Table ${order.tableNumber}` : order.channel ?? "Counter"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`font-mono text-lg font-bold tabular-nums ${
                                urgency === "late"
                                  ? "text-[#ff8f7d]"
                                  : urgency === "watch"
                                    ? "text-[#e7c27d]"
                                    : "text-[#f0d9a8]"
                              }`}
                            >
                              {timer}
                            </p>
                            {urgency !== "ok" ? (
                              <p className="text-[10px] font-bold uppercase tracking-wide text-[#e35d4a]">
                                {urgency === "late" ? "Delayed" : "Priority"}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {/* Back / Next — always above items so cooks never scroll for the step */}
                        <div className="grid grid-cols-2 gap-2 px-3 py-2.5">
                          <button
                            type="button"
                            disabled={pending || busyId === order.id || !columnMeta.back}
                            onClick={() => columnMeta.back && moveOrder(order, columnMeta.back)}
                            className="min-h-10 rounded-xl border border-white/15 text-sm font-semibold text-[#cfc4b6] disabled:opacity-30"
                          >
                            ← Back
                          </button>
                          <button
                            type="button"
                            disabled={pending || busyId === order.id || !columnMeta.next}
                            onClick={() => columnMeta.next && moveOrder(order, columnMeta.next)}
                            className="min-h-10 rounded-xl border border-[#e7c27d] bg-[#e7c27d]/15 text-sm font-bold text-[#e7c27d] disabled:opacity-30"
                          >
                            {busyId === order.id ? "…" : `Next →`}
                          </button>
                        </div>

                        {order.orderNote ? (
                          <p className="mx-3 mb-2 rounded-lg bg-[#e7c27d]/10 px-2 py-1 text-xs text-[#e7c27d]">
                            Note: {order.orderNote}
                          </p>
                        ) : null}

                        <ul className="max-h-48 space-y-1.5 overflow-y-auto px-3 pb-3">
                          {order.items.map((item, index) => {
                            const lineId = item.lineId ?? `legacy-${index}`;
                            return (
                              <li key={lineId} className="rounded-xl bg-black/30 px-2.5 py-2">
                                <p className="text-sm font-semibold leading-snug">
                                  {item.quantity}× {item.dishNameSnapshot}
                                  {item.variantNameSnapshot ? ` (${item.variantNameSnapshot})` : ""}
                                </p>
                                {item.addons.length > 0 ? (
                                  <p className="text-[11px] text-[#b9a792]">
                                    {item.addons.map((addon) => addon.nameSnapshot).join(", ")}
                                  </p>
                                ) : null}
                                {item.note ? <p className="text-[11px] text-[#e7c27d]">{item.note}</p> : null}
                                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#8f816f]">
                                    {item.kitchenStation ?? "MAIN"} · {item.preparationStatus ?? "QUEUED"}
                                  </span>
                                  {order.status === "PREPARING" || order.status === "ACCEPTED" ? (
                                    <span className="flex gap-1">
                                      <button
                                        type="button"
                                        disabled={pending}
                                        onClick={() => setItemStatus(order.id, lineId, "PREPARING")}
                                        className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold"
                                      >
                                        Start
                                      </button>
                                      <button
                                        type="button"
                                        disabled={pending}
                                        onClick={() => setItemStatus(order.id, lineId, "READY")}
                                        className="rounded-md bg-emerald-700/80 px-1.5 py-0.5 text-[10px] font-bold"
                                      >
                                        Ready
                                      </button>
                                    </span>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>

                        <div className="flex gap-2 border-t border-white/5 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => printKitchenOrderTicket(order, restaurantName)}
                            className="min-h-9 flex-1 rounded-lg bg-white/5 text-[11px] font-semibold text-[#cfc4b6]"
                          >
                            Print KOT
                          </button>
                          {columnMeta.next ? (
                            <button
                              type="button"
                              disabled={pending || busyId === order.id}
                              onClick={() => moveOrder(order, columnMeta.next!)}
                              className="min-h-9 flex-[1.4] rounded-lg bg-[#e7c27d] text-[11px] font-bold text-[#12100e] disabled:opacity-40"
                            >
                              {columnMeta.nextLabel}
                            </button>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
