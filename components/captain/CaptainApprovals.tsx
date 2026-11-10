"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { OrderSummary } from "@/types";
import { resolveAuthorization } from "@/lib/order-authorization";
import { Clock3, ShieldCheck, ShieldX } from "lucide-react";
import { orderLocationName } from "@/lib/service-location";

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function elapsed(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function CaptainApprovals({
  initialOrders,
  currency = "INR",
}: {
  initialOrders: OrderSummary[];
  currency?: string;
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [filterTable, setFilterTable] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{
    order: OrderSummary;
    decision: "REJECT" | "CORRECTION";
  } | null>(null);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/captain/approvals");
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Unable to refresh");
      setOrders(json.data);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh approvals");
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 8000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const filtered = useMemo(() => {
    if (!filterTable) return orders;
    return orders.filter((order) => order.tableId === filterTable);
  }, [orders, filterTable]);

  async function decide(
    order: OrderSummary,
    decision: "APPROVE" | "REJECT" | "CORRECTION",
    reasonText?: string,
  ) {
    setBusyId(order.id);
    setMessage("");
    try {
      const response = await fetch(`/api/captain/orders/${order.id}/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          reason: reasonText,
          idempotencyKey: crypto.randomUUID(),
          sendToKitchen: false,
        }),
      });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || "Authorization failed");
      setOrders((prev) => prev.filter((row) => row.id !== order.id));
      setReasonModal(null);
      setReason("");
      setMessage(
        decision === "APPROVE"
          ? `Order #${order.orderNumber} approved · moved to New orders`
          : `Order #${order.orderNumber} ${decision === "REJECT" ? "rejected" : "sent back for correction"}`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authorization failed");
      void refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">Authorization</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Pending approvals</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-500">
            Customer ordered on QR at one of your tables. Approve after checking the dishes; the order then appears
            under New. Kitchen and KOT remain empty until the order is separately accepted.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm">
            Location
            <select
              value={filterTable}
              onChange={(event) => setFilterTable(event.target.value)}
              className="ml-2 min-h-10 rounded-xl border border-neutral-200 bg-white px-2"
            >
              <option value="">All locations</option>
              {[...new Map(orders.map((order) => [order.tableId, order])).values()].map((order) => <option key={order.tableId} value={order.tableId}>{orderLocationName(order)}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => startTransition(() => void refresh())}
            disabled={pending}
            className="min-h-10 rounded-full border border-neutral-300 px-4 text-sm font-semibold"
          >
            Refresh
          </button>
        </div>
      </header>

      {message ? (
        <p
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            /fail|unable|conflict|cannot|required/i.test(message)
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {message}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center text-sm text-neutral-500">
          No QR orders waiting for your approval.
        </p>
      ) : (
        <ul className="space-y-4">
          {filtered.map((order) => {
            const waitMins = Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000);
            const delayed = waitMins >= 8;
            const auth = resolveAuthorization(order);
            return (
              <li
                key={order.id}
                className={`rounded-3xl border bg-white p-5 shadow-sm ${
                  delayed ? "border-amber-300 ring-1 ring-amber-200" : "border-neutral-200"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-bold">
                      Order #{order.orderNumber} · {orderLocationName(order)}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                      <span>{auth.entrySource.replace(/_/g, " ")}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="h-3.5 w-3.5" /> {elapsed(order.createdAt)}
                      </span>
                      {delayed ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">Waiting long</span>
                      ) : null}
                    </p>
                  </div>
                  <p className="text-xl font-bold tabular-nums">{money(order.total, currency)}</p>
                </div>

                <ul className="mt-4 divide-y divide-neutral-100 rounded-2xl border border-neutral-100">
                  {order.items.map((item) => (
                    <li
                      key={item.lineId ?? `${item.dishId}-${item.variantId}`}
                      className="flex justify-between gap-3 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-semibold">
                          {item.quantity}× {item.dishNameSnapshot}
                          {item.variantNameSnapshot ? ` · ${item.variantNameSnapshot}` : ""}
                        </p>
                        {item.addons?.length ? (
                          <p className="text-xs text-neutral-500">
                            {item.addons.map((addon) => addon.nameSnapshot).join(", ")}
                          </p>
                        ) : null}
                        {item.note ? <p className="text-xs text-amber-800">Note: {item.note}</p> : null}
                      </div>
                      <p className="tabular-nums">{money(item.itemTotal, currency)}</p>
                    </li>
                  ))}
                </ul>

                {order.orderNote ? (
                  <p className="mt-3 rounded-2xl bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                    Customer note: {order.orderNote}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => void decide(order, "APPROVE")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    Approve order
                  </button>
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => setReasonModal({ order, decision: "CORRECTION" })}
                    className="min-h-11 rounded-full border border-neutral-300 px-4 text-sm font-semibold"
                  >
                    Request correction
                  </button>
                  <button
                    type="button"
                    disabled={busyId === order.id}
                    onClick={() => setReasonModal({ order, decision: "REJECT" })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-rose-300 px-4 text-sm font-semibold text-rose-700"
                  >
                    <ShieldX className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {reasonModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-950/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-bold">
              {reasonModal.decision === "REJECT" ? "Reject order" : "Request correction"} #
              {reasonModal.order.orderNumber}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">Reason is required. No KOT will be generated.</p>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              className="mt-3 w-full rounded-2xl border border-neutral-200 px-3 py-2 text-sm"
              placeholder="Missing spice level, wrong variant, allergy note…"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold"
                onClick={() => {
                  setReasonModal(null);
                  setReason("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!reason.trim() || busyId === reasonModal.order.id}
                className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                onClick={() => void decide(reasonModal.order, reasonModal.decision, reason.trim())}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
