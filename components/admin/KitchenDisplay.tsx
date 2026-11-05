"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { KitchenStation, OrderSummary } from "@/types";
import { Maximize2, Minimize2, Volume2, VolumeX } from "lucide-react";

const STATIONS: { id: KitchenStation | "ALL"; label: string }[] = [
  { id: "ALL", label: "All stations" },
  { id: "MAIN", label: "Main Kitchen" },
  { id: "BAR", label: "Bar" },
  { id: "BAKERY", label: "Bakery" },
  { id: "DESSERT", label: "Desserts" },
  { id: "OTHER", label: "Other" },
];

function ageMinutes(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

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
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    /* ignore */
  }
}

type KitchenDisplayProps = {
  restaurantName: string;
  initialOrders: OrderSummary[];
};

export default function KitchenDisplay({ restaurantName, initialOrders }: KitchenDisplayProps) {
  const [orders, setOrders] = useState(initialOrders);
  const [station, setStation] = useState<KitchenStation | "ALL">("ALL");
  const [soundOn, setSoundOn] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const knownIds = useRef(new Set(initialOrders.map((order) => order.id)));
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const query = station === "ALL" ? "" : `?station=${station}`;
      const response = await fetch(`/api/kitchen/orders${query}`, { cache: "no-store" });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Failed to load");
      const next: OrderSummary[] = json.data;
      const fresh = next.filter((order) => !knownIds.current.has(order.id));
      if (fresh.length > 0 && soundOn) playChime();
      knownIds.current = new Set(next.map((order) => order.id));
      setOrders(next);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Connection issue — retrying");
    }
  }, [station, soundOn]);

  useEffect(() => {
    const poll = window.setInterval(() => {
      void load();
    }, 4000);
    const clock = window.setInterval(() => setNow(Date.now()), 15000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
    };
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFs = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function setItemStatus(
    orderId: string,
    lineId: string,
    preparationStatus: "PREPARING" | "READY",
  ) {
    const response = await fetch(`/api/kitchen/orders/${orderId}/items`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineId, preparationStatus }),
    });
    const json = await response.json();
    if (!json.success) {
      setError(json.error || "Update failed");
      return;
    }
    await load();
  }

  async function completeOrder(orderId: string) {
    const response = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "READY" }),
    });
    const json = await response.json();
    if (!json.success) {
      setError(json.error || "Could not mark ready");
      return;
    }
    await load();
  }

  function toggleFullscreen() {
    if (!rootRef.current) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void rootRef.current.requestFullscreen();
    }
  }

  void now;

  return (
    <div
      ref={rootRef}
      className="min-h-[calc(100vh-4rem)] bg-[#12100e] text-[#f4ebe1]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#b9a792]">Kitchen display</p>
          <h1 className="text-2xl font-semibold">{restaurantName}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {STATIONS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setStation(entry.id)}
              className={`min-h-10 rounded-lg px-3 text-sm ${
                station === entry.id ? "bg-[#e7c27d] text-[#12100e]" : "bg-white/10"
              }`}
            >
              {entry.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSoundOn((value) => !value)}
            className="min-h-10 min-w-10 rounded-lg bg-white/10"
            aria-label={soundOn ? "Mute notifications" : "Enable sound"}
          >
            {soundOn ? <Volume2 className="mx-auto h-4 w-4" /> : <VolumeX className="mx-auto h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            className="min-h-10 min-w-10 rounded-lg bg-white/10"
            aria-label="Toggle fullscreen"
          >
            {fullscreen ? (
              <Minimize2 className="mx-auto h-4 w-4" />
            ) : (
              <Maximize2 className="mx-auto h-4 w-4" />
            )}
          </button>
        </div>
      </header>

      {error ? (
        <p className="bg-[#5c241c] px-4 py-2 text-sm text-[#ffd7cf]">{error} · auto-recovering</p>
      ) : null}

      <div className="grid gap-3 p-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {orders.map((order) => {
          const age = ageMinutes(order.createdAt);
          const delayed = age >= 15;
          const priority = age >= 10;
          return (
            <article
              key={order.id}
              className={`rounded-2xl border p-4 ${
                delayed
                  ? "border-[#e35d4a] bg-[#3a1713]"
                  : priority
                    ? "border-[#e7c27d] bg-[#2a2218]"
                    : "border-white/10 bg-[#1b1815]"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-3xl font-bold tracking-tight">#{order.orderNumber}</p>
                  <p className="text-sm text-[#b9a792]">
                    {order.tableNumber > 0 ? `Table ${order.tableNumber}` : order.channel ?? "Counter"}
                    {" · "}
                    {age} min
                    {delayed ? " · DELAYED" : priority ? " · PRIORITY" : ""}
                  </p>
                </div>
                <span className="rounded-md bg-white/10 px-2 py-1 text-xs uppercase tracking-wide">
                  {order.status}
                </span>
              </div>
              {order.orderNote ? (
                <p className="mt-2 rounded-lg bg-black/20 px-2 py-1 text-sm text-[#e7c27d]">
                  Note: {order.orderNote}
                </p>
              ) : null}
              <ul className="mt-3 space-y-2">
                {order.items.map((item, index) => {
                  const lineId = item.lineId ?? `legacy-${index}`;
                  return (
                    <li key={lineId} className="rounded-xl bg-black/25 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-lg font-semibold">
                            {item.quantity}× {item.dishNameSnapshot}
                            {item.variantNameSnapshot ? ` (${item.variantNameSnapshot})` : ""}
                          </p>
                          {item.addons.length > 0 ? (
                            <p className="text-sm text-[#b9a792]">
                              {item.addons.map((addon) => addon.nameSnapshot).join(", ")}
                            </p>
                          ) : null}
                          {item.note ? (
                            <p className="text-sm text-[#e7c27d]">{item.note}</p>
                          ) : null}
                          <p className="mt-1 text-xs uppercase tracking-wide text-[#8f816f]">
                            {item.kitchenStation ?? "MAIN"} · {item.preparationStatus ?? "QUEUED"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void setItemStatus(order.id, lineId, "PREPARING")}
                          className="min-h-10 flex-1 rounded-lg bg-[#e7c27d]/20 text-sm"
                        >
                          Start
                        </button>
                        <button
                          type="button"
                          onClick={() => void setItemStatus(order.id, lineId, "READY")}
                          className="min-h-10 flex-1 rounded-lg bg-[#3d6b4f] text-sm"
                        >
                          Item ready
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <button
                type="button"
                onClick={() => void completeOrder(order.id)}
                className="mt-3 min-h-11 w-full rounded-xl bg-[#e7c27d] font-semibold text-[#12100e]"
              >
                Mark order ready
              </button>
            </article>
          );
        })}
        {orders.length === 0 ? (
          <p className="col-span-full py-20 text-center text-[#8f816f]">No active kitchen tickets</p>
        ) : null}
      </div>
    </div>
  );
}
