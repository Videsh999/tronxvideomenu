"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import type { OrderSummary } from "@/types";
import { RefreshCw } from "lucide-react";
import { printKitchenOrderTicket } from "@/lib/kot-print";

function ageMinutes(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export default function CaptainKitchenBoard({
  slug,
  restaurantName,
  initialOrders,
}: {
  slug: string;
  restaurantName: string;
  initialOrders: OrderSummary[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const response = await fetch("/api/captain/kitchen", { cache: "no-store" });
    const json = await response.json();
    if (!json.success) throw new Error(json.error || "Unable to refresh kitchen");
    setOrders(json.data);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh().catch(() => null);
    }, 8000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  function setItemStatus(orderId: string, lineId: string, preparationStatus: "PREPARING" | "READY") {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(`/api/kitchen/orders/${orderId}/items`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineId, preparationStatus }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Update failed");
        setOrders((current) => current.map((order) => (order.id === json.data.id ? json.data : order)));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Update failed");
      }
    });
  }

  function markReady(orderId: string) {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(`/api/captain/orders/${orderId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "READY" }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Could not mark ready");
        setOrders((current) => current.filter((order) => order.id !== orderId));
        setMessage(`Order marked ready`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not mark ready");
      }
    });
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Kitchen tracking</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">KOT status</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Tickets for your assigned tables after Accept / Approve. Start items, mark ready, then serve.
          </p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              try {
                await refresh();
                setMessage(null);
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "Refresh failed");
              }
            })
          }
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-neutral-300 px-3 text-sm font-semibold"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </header>

      {message ? (
        <p
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            /fail|unable|could not|only be updated/i.test(message)
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {message}
        </p>
      ) : null}

      {orders.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No kitchen tickets for your assigned tables. Accept new orders from Active or the table workspace first.
        </p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => {
            const age = ageMinutes(order.createdAt);
            return (
              <li key={order.id} className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-bold">
                      Order #{order.orderNumber} · Table {order.tableNumber}
                    </p>
                    <p className="text-xs uppercase tracking-wide text-neutral-400">
                      {order.status} · {age} min
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => printKitchenOrderTicket(order, restaurantName)}
                      className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold"
                    >
                      Reprint KOT
                    </button>
                    <Link
                      href={`/captain/${slug}/tables`}
                      className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs font-semibold"
                    >
                      Open tables
                    </Link>
                  </div>
                </div>
                <ul className="mt-4 space-y-2">
                  {order.items.map((item, index) => {
                    const lineId = item.lineId ?? `legacy-${index}`;
                    return (
                      <li
                        key={lineId}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-neutral-50 px-3 py-2 text-sm"
                      >
                        <span>
                          {item.quantity}× {item.dishNameSnapshot}
                          {item.variantNameSnapshot ? ` · ${item.variantNameSnapshot}` : ""}
                          <span className="ml-2 text-[11px] font-bold uppercase text-neutral-500">
                            {item.kitchenStation ?? "MAIN"} · {item.preparationStatus ?? "QUEUED"}
                          </span>
                        </span>
                        <span className="flex gap-1">
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setItemStatus(order.id, lineId, "PREPARING")}
                            className="rounded-lg border border-neutral-300 px-2 py-1 text-[11px] font-semibold disabled:opacity-40"
                          >
                            Start
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => setItemStatus(order.id, lineId, "READY")}
                            className="rounded-lg bg-emerald-700 px-2 py-1 text-[11px] font-bold text-white disabled:opacity-40"
                          >
                            Item ready
                          </button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => markReady(order.id)}
                  className="mt-4 min-h-11 w-full rounded-xl bg-[#e7c27d] text-sm font-bold text-neutral-900 disabled:opacity-50"
                >
                  Mark order ready
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
