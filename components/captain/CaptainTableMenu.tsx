"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderSummary, RestaurantTable } from "@/types";
import { formatRupeeTotal, isRunningOrder, kotItemStatus } from "@/lib/captain-floor";
import { clearFloorAttempt, floorAttemptKey } from "@/lib/captain/floor-attempt";
import { browserPaymentStore } from "@/lib/payments/payment-attempt";

const STATUS_LABEL = { sent: "Sent", preparing: "Preparing", ready: "Ready", served: "Served" };

export default function CaptainTableMenu({
  table,
  tables,
  orders,
  onClose,
  onDone,
}: {
  table: RestaurantTable;
  tables: RestaurantTable[];
  orders: OrderSummary[];
  onClose: () => void;
  onDone: () => void;
}) {
  const running = orders.filter((order) => order.tableNumber === table.tableNumber && isRunningOrder(order.status));
  const bill = running[0];
  const free = tables.filter(
    (entry) => entry.id !== table.id && entry.isActive && (entry.status === "OPEN" || entry.status === "CLEANING"),
  );
  const occupied = tables.filter(
    (entry) => entry.id !== table.id && runningOrders(orders, entry.tableNumber).length > 0,
  );
  const [mode, setMode] = useState<"home" | "move" | "merge" | "split" | "void">("home");
  const [ways, setWays] = useState(2);
  const [selected, setSelected] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [lineId, setLineId] = useState("");
  const [shares, setShares] = useState<number[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      [...(node?.querySelectorAll<HTMLElement>("button, input, [href], [tabindex]:not([tabindex='-1'])") ?? [])].filter(
        (element) => !element.hasAttribute("disabled"),
      );
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !node) return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  async function send(action: string, subject: string, body: Record<string, unknown>) {
    setBusy(true);
    setError("");
    const storage = browserPaymentStore();
    const idempotencyKey = floorAttemptKey(action, subject, storage);
    const response = await fetch("/api/captain/floor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, action, idempotencyKey }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      data?: { shares?: number[]; pending?: boolean };
    };
    setBusy(false);
    if (!response.ok) {
      setError(payload.error || "Could not update the table.");
      return null;
    }
    clearFloorAttempt(action, subject, storage);
    return payload.data ?? {};
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Table actions"
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black">Table {table.tableNumber}</h2>
          <button type="button" onClick={onClose} className="min-h-12 px-3 text-base font-bold">
            Close
          </button>
        </div>
        {mode === "home" ? (
          <div className="mt-3 grid gap-2">
            <button type="button" disabled={!bill || !free.length} onClick={() => setMode("move")} className="min-h-14 rounded-2xl bg-neutral-900 font-black text-white disabled:opacity-40">
              Move table
            </button>
            <button type="button" disabled={!bill || !occupied.length} onClick={() => setMode("merge")} className="min-h-14 rounded-2xl bg-neutral-900 font-black text-white disabled:opacity-40">
              Merge into another bill
            </button>
            <button type="button" disabled={!bill} onClick={() => setMode("split")} className="min-h-14 rounded-2xl bg-neutral-900 font-black text-white disabled:opacity-40">
              Split bill
            </button>
            <button type="button" disabled={!bill} onClick={() => setMode("void")} className="min-h-14 rounded-2xl bg-white font-black disabled:opacity-40">
              Void an item
            </button>
          </div>
        ) : null}
        {mode === "move" ? (
          <div className="mt-3 grid gap-2">
            {free.map((entry) => (
              <button
                key={entry.id}
                type="button"
                disabled={busy}
                onClick={() =>
                  void send("MOVE", `${table.id}:${entry.id}`, { fromTableId: table.id, toTableId: entry.id }).then((result) => {
                    if (result) onDone();
                  })
                }
                className="min-h-14 rounded-2xl bg-emerald-600 text-lg font-black text-white"
              >
                Move to {entry.tableNumber}
              </button>
            ))}
          </div>
        ) : null}
        {mode === "merge" ? (
          <div className="mt-3 grid gap-2">
            {occupied.map((entry) => (
              <button
                key={entry.id}
                type="button"
                disabled={busy}
                onClick={() =>
                  void send("MERGE", `${table.id}:${entry.id}`, { fromTableId: table.id, toTableId: entry.id }).then((result) => {
                    if (result) onDone();
                  })
                }
                className="min-h-14 rounded-2xl bg-amber-500 text-lg font-black"
              >
                Merge into {entry.tableNumber}
              </button>
            ))}
          </div>
        ) : null}
        {mode === "split" && bill ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm font-semibold">Payment is not taken here.</p>
            {activeLines(bill).map((line) => (
              <label key={line.lineId} className="flex min-h-12 items-center gap-3 text-base font-bold">
                <input
                  type="checkbox"
                  className="h-6 w-6"
                  checked={selected.includes(line.lineId!)}
                  onChange={() =>
                    setSelected((current) =>
                      current.includes(line.lineId!) ? current.filter((id) => id !== line.lineId) : [...current, line.lineId!],
                    )
                  }
                />
                {line.quantity} {line.dishNameSnapshot}
                <span className="text-sm font-semibold text-neutral-500">{STATUS_LABEL[kotItemStatus(line, bill.status)]}</span>
              </label>
            ))}
            <button
              type="button"
              disabled={busy || selected.length === 0}
              onClick={() =>
                void send("SPLIT_ITEMS", table.id, { tableId: table.id, lineIds: selected }).then((result) => {
                  if (result) onDone();
                })
              }
              className="min-h-14 w-full rounded-2xl bg-neutral-900 font-black text-white disabled:opacity-40"
            >
              Split selected items
            </button>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => setWays((value) => Math.max(2, value - 1))} className="h-14 w-14 rounded-full bg-neutral-100 text-2xl font-black">
                −
              </button>
              <span className="text-3xl font-black">{ways}</span>
              <button type="button" onClick={() => setWays((value) => Math.min(20, value + 1))} className="h-14 w-14 rounded-full bg-neutral-100 text-2xl font-black">
                +
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void send("SPLIT_EQUAL", `${table.id}:${ways}`, { tableId: table.id, ways }).then((result) => {
                  if (result?.shares) setShares(result.shares);
                })
              }
              className="min-h-14 w-full rounded-2xl bg-neutral-900 font-black text-white"
            >
              Split equally
            </button>
            {shares ? (
              <p className="text-lg font-black">
                {shares.map((share) => formatRupeeTotal(share)).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {mode === "void" && bill ? (
          <div className="mt-3 space-y-3">
            {activeLines(bill).map((line) => (
              <button
                key={line.lineId}
                type="button"
                onClick={() => setLineId(line.lineId!)}
                className={`min-h-14 w-full rounded-2xl px-3 text-left font-bold ${lineId === line.lineId ? "bg-neutral-900 text-white" : "bg-neutral-100"}`}
              >
                {line.quantity} {line.dishNameSnapshot}
                <span className="ml-2 text-sm">{STATUS_LABEL[kotItemStatus(line, bill.status)]}</span>
              </button>
            ))}
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for void"
              className="min-h-14 w-full rounded-2xl border border-neutral-200 px-3"
            />
            <button
              type="button"
              disabled={busy || !lineId || reason.trim().length < 3}
              onClick={() =>
                void send("VOID_ITEM", `${bill.id}:${lineId}`, {
                  tableId: table.id,
                  orderId: bill.id,
                  lineId,
                  quantity: 1,
                  reason: reason.trim(),
                }).then((result) => {
                  if (result) onDone();
                })
              }
              className="min-h-14 w-full rounded-2xl bg-rose-700 font-black text-white disabled:opacity-40"
            >
              Request void
            </button>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm font-semibold text-rose-700">{error}</p> : null}
      </div>
    </div>
  );
}

function runningOrders(orders: OrderSummary[], tableNumber: number) {
  return orders.filter((order) => order.tableNumber === tableNumber && isRunningOrder(order.status));
}

function activeLines(order: OrderSummary) {
  return order.items.filter((item) => item.lineId && item.quantity - (item.cancelledQuantity ?? 0) > 0);
}
