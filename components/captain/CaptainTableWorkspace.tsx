"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BellRing,
  ClipboardList,
  Plus,
  Sparkles,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { OrderSummary, RestaurantTable } from "@/types";
import type { ServiceRequest, ServiceRequestType } from "@/types/service-request";
import { TABLE_STATUS_LABEL, TABLE_STATUS_STYLE } from "@/lib/captain-floor";

function money(value: number, currency = "INR") {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

const REQUEST_TYPES: { type: ServiceRequestType; label: string }[] = [
  { type: "WATER", label: "Water" },
  { type: "EXTRA_PLATES", label: "Extra plates" },
  { type: "CUTLERY", label: "Cutlery" },
  { type: "NAPKINS", label: "Napkins" },
  { type: "ASSISTANCE", label: "Assistance" },
  { type: "CLEANING", label: "Cleaning" },
  { type: "BILL", label: "Bill" },
  { type: "OTHER", label: "Other" },
];

export default function CaptainTableWorkspace({
  slug,
  captainName,
  currency,
  initialTable,
  initialOrder,
  initialRequests,
}: {
  slug: string;
  captainName: string;
  currency: string;
  initialTable: RestaurantTable;
  initialOrder: OrderSummary | null;
  initialRequests: ServiceRequest[];
}) {
  const [table, setTable] = useState(initialTable);
  const [order, setOrder] = useState(initialOrder);
  const [requests, setRequests] = useState(initialRequests);
  const [guestCount, setGuestCount] = useState(String(initialOrder?.guestCount ?? ""));
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openRequests = useMemo(
    () => requests.filter((request) => !["DONE", "CANCELLED"].includes(request.status)),
    [requests],
  );

  function runAction(action: string, body: Record<string, unknown> = {}) {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch(`/api/captain/tables/${table.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...body }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Action failed");
        setTable(json.data);
        setMessage("Updated");
        const refresh = await fetch(`/api/captain/tables/${table.id}`);
        const refreshed = await refresh.json();
        if (refreshed.success) {
          setTable(refreshed.data.table);
          setOrder(refreshed.data.activeOrder);
          setRequests(refreshed.data.requests);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Action failed");
      }
    });
  }

  function createRequest(type: ServiceRequestType) {
    startTransition(async () => {
      setMessage(null);
      try {
        const response = await fetch("/api/captain/requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tableId: table.id, type, note: note.trim() || undefined }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Unable to create request");
        setRequests((prev) => [json.data, ...prev]);
        setNote("");
        setMessage(`${type.replace(/_/g, " ")} logged`);
        if (type === "BILL" || type === "CLEANING") {
          const refresh = await fetch(`/api/captain/tables/${table.id}`);
          const refreshed = await refresh.json();
          if (refreshed.success) setTable(refreshed.data.table);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to create request");
      }
    });
  }

  function advanceRequest(id: string, status: "ACKNOWLEDGED" | "IN_PROGRESS" | "DONE") {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/captain/requests/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Unable to update");
        setRequests((prev) => prev.map((row) => (row.id === id ? json.data : row)));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to update request");
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 rounded-[2rem] border border-neutral-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div>
          <Link
            href={`/captain/${slug}/tables`}
            className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" /> My Tables
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-black tracking-tight">Table {table.tableNumber}</h1>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${TABLE_STATUS_STYLE[table.status]}`}
            >
              {TABLE_STATUS_LABEL[table.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">
            {table.label || "Dining table"} · {table.capacity ?? "—"} seats · Captain {captainName}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/captain/${slug}/take-order?table=${table.tableNumber}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-bold text-white"
          >
            <UtensilsCrossed className="h-4 w-4" />
            {order ? "Add items" : "New order"}
          </Link>
          <button
            type="button"
            disabled={pending}
            onClick={() => runAction("START_SERVICE")}
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 text-sm font-semibold"
          >
            <Sparkles className="h-4 w-4" /> Start service
          </button>
        </div>
      </header>

      {message ? (
        <p
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            /unable|failed|cannot|no active/i.test(message)
              ? "border border-rose-200 bg-rose-50 text-rose-800"
              : "border border-emerald-200 bg-emerald-50 text-emerald-900"
          }`}
        >
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="space-y-4 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Active order</h2>
            {order ? (
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                #{order.orderNumber} · {order.status}
              </span>
            ) : null}
          </div>

          {!order ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 p-6 text-center">
              <p className="font-semibold">No active order</p>
              <p className="mt-1 text-sm text-neutral-500">
                Take a verbal order — guest phone not required.
              </p>
              <Link
                href={`/captain/${slug}/take-order?table=${table.tableNumber}`}
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-neutral-900 px-4 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" /> Start ordering
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <p className="text-[11px] uppercase text-neutral-400">Amount</p>
                  <p className="mt-1 text-xl font-bold tabular-nums">{money(order.total, currency)}</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <p className="text-[11px] uppercase text-neutral-400">Payment</p>
                  <p className="mt-1 font-semibold">{order.payment?.status ?? "UNPAID"}</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <p className="text-[11px] uppercase text-neutral-400">Items</p>
                  <p className="mt-1 font-semibold">{order.items.length}</p>
                </div>
                <div className="rounded-2xl bg-neutral-50 p-3">
                  <p className="text-[11px] uppercase text-neutral-400">Kitchen</p>
                  <p className="mt-1 font-semibold">
                    {order.items.filter((item) => item.preparationStatus === "READY").length}/
                    {order.items.length} ready
                  </p>
                </div>
              </div>

              <ul className="divide-y divide-neutral-100 rounded-2xl border border-neutral-100">
                {order.items.map((item) => (
                  <li key={item.lineId ?? `${item.dishId}-${item.variantId}`} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                    <div>
                      <p className="font-semibold">
                        {item.quantity}× {item.dishNameSnapshot}
                        {item.variantNameSnapshot ? ` · ${item.variantNameSnapshot}` : ""}
                      </p>
                      {item.note ? <p className="text-xs text-neutral-500">{item.note}</p> : null}
                      <p className="text-[11px] uppercase tracking-wide text-neutral-400">
                        {(item.kitchenStation ?? "MAIN").toLowerCase()} ·{" "}
                        {(item.preparationStatus ?? "QUEUED").toLowerCase()}
                      </p>
                    </div>
                    <p className="tabular-nums font-medium">{money(item.itemTotal, currency)}</p>
                  </li>
                ))}
              </ul>

              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/captain/${slug}/take-order?table=${table.tableNumber}`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-300 px-4 text-sm font-semibold"
                >
                  <Plus className="h-4 w-4" /> Add items
                </Link>
                <Link
                  href={`/captain/${slug}/kitchen`}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full border border-neutral-300 px-4 text-sm font-semibold"
                >
                  <ClipboardList className="h-4 w-4" /> KOT / kitchen
                </Link>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => runAction("REQUEST_BILL")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-full bg-violet-600 px-4 text-sm font-bold text-white"
                >
                  <Wallet className="h-4 w-4" /> Request bill
                </button>
              </div>
            </>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Service notes</h2>
            <label className="mt-3 block text-sm">
              Guest count
              <input
                type="number"
                min={1}
                max={100}
                value={guestCount}
                onChange={(event) => setGuestCount(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-xl border border-neutral-200 px-3"
              />
            </label>
            <label className="mt-3 block text-sm">
              Note / request detail
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-xl border border-neutral-200 px-3 py-2"
                placeholder="Allergy note, preference…"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => runAction("ADD_NOTE", { note })}
                className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold"
              >
                Save note
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => runAction("REQUEST_CLEANING")}
                className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold"
              >
                Request cleaning
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => runAction("COMPLETE_CLEANING")}
                className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
              >
                Mark available
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <BellRing className="h-4 w-4" />
              <h2 className="text-lg font-bold">Customer requests</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {REQUEST_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  disabled={pending}
                  onClick={() => createRequest(type)}
                  className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold hover:border-neutral-900"
                >
                  {label}
                </button>
              ))}
            </div>
            <ul className="mt-4 space-y-2">
              {openRequests.length === 0 ? (
                <li className="text-sm text-neutral-500">No open requests.</li>
              ) : (
                openRequests.map((request) => (
                  <li
                    key={request.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-neutral-100 px-3 py-2 text-sm"
                  >
                    <span>
                      {request.type.replace(/_/g, " ")} · {request.status}
                      {request.note ? ` — ${request.note}` : ""}
                    </span>
                    <span className="flex gap-1">
                      {request.status === "OPEN" ? (
                        <button
                          type="button"
                          className="rounded-lg bg-neutral-900 px-2 py-1 text-[11px] font-bold text-white"
                          onClick={() => advanceRequest(request.id, "ACKNOWLEDGED")}
                        >
                          Ack
                        </button>
                      ) : null}
                      {request.status !== "DONE" ? (
                        <button
                          type="button"
                          className="rounded-lg border border-neutral-300 px-2 py-1 text-[11px] font-semibold"
                          onClick={() => advanceRequest(request.id, "DONE")}
                        >
                          Done
                        </button>
                      ) : null}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
