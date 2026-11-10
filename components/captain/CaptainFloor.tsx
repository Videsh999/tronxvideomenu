"use client";

import { useEffect, useMemo, useState } from "react";
import type { OrderSummary, RestaurantTable, TableStatus } from "@/types";
import type { CaptainPermissions } from "@/types";
import {
  formatOccupiedDuration,
  formatRupeeTotal,
  groupTablesBySection,
  runningBillFromServer,
} from "@/lib/captain-floor";
import { captainMayRecordPayment, resolveCaptainPermissions } from "@/lib/captain-permissions";
import { browserPaymentStore, clearPaymentAttempt, paymentAttemptKey } from "@/lib/payments/payment-attempt";

type MenuDish = {
  id: string;
  name: string;
  price: number;
  categoryId: string;
  variants: { id: string; name: string; price: number }[];
};

type CartLine = {
  key: string;
  dishId: string;
  name: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  note: string;
};

type SentLine = { name: string; quantity: number; note?: string };

const FILTERS: { id: string; label: string; match?: TableStatus[] }[] = [
  { id: "all", label: "All" },
  { id: "free", label: "Free", match: ["OPEN"] },
  { id: "occupied", label: "Occupied", match: ["OCCUPIED"] },
  { id: "bill", label: "Bill", match: ["BILL_REQUESTED"] },
  { id: "payment", label: "Payment", match: ["PAYMENT_PENDING"] },
];

const CARD: Record<TableStatus, string> = {
  OPEN: "bg-emerald-100 text-emerald-950 border-emerald-300",
  OCCUPIED: "bg-amber-100 text-amber-950 border-amber-300",
  BILL_REQUESTED: "bg-violet-100 text-violet-950 border-violet-300",
  PAYMENT_PENDING: "bg-sky-100 text-sky-950 border-sky-300",
  CLEANING: "bg-neutral-200 text-neutral-800 border-neutral-300",
  CLOSED: "bg-rose-100 text-rose-950 border-rose-300",
};

const LABEL: Record<TableStatus, string> = {
  OPEN: "Free",
  OCCUPIED: "Occupied",
  BILL_REQUESTED: "Bill",
  PAYMENT_PENDING: "Payment",
  CLEANING: "Cleaning",
  CLOSED: "Closed",
};

function activeOrder(orders: OrderSummary[], tableNumber: number) {
  return (
    orders.find(
      (order) =>
        order.tableNumber === tableNumber &&
        !["COMPLETED", "CANCELLED", "REJECTED"].includes(order.status),
    ) ?? null
  );
}

export default function CaptainFloor({
  slug,
  captainName,
  permissions,
  initialTables,
  initialOrders,
  categories,
  dishes,
}: {
  slug: string;
  captainName: string;
  permissions: CaptainPermissions | undefined;
  initialTables: RestaurantTable[];
  initialOrders: OrderSummary[];
  categories: { id: string; name: string }[];
  dishes: MenuDish[];
}) {
  const gates = resolveCaptainPermissions({ permissions });
  const [tables, setTables] = useState(initialTables);
  const [orders, setOrders] = useState(initialOrders);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<
    | { kind: "grid" }
    | { kind: "guests"; tableId: string; count: number }
    | { kind: "order"; tableId: string }
    | { kind: "detail"; tableId: string }
    | { kind: "kot"; tableId: string; kotNumber: number; lines: SentLine[]; at: string }
    | { kind: "bill"; tableId: string }
  >({ kind: "grid" });
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "all");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sendKey, setSendKey] = useState<string | null>(null);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(Date.now()), 30000);
    const poll = window.setInterval(() => {
      void refresh();
    }, 10000);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(poll);
    };
  }, []);

  async function refresh() {
    const [tableRes, orderRes] = await Promise.all([
      fetch("/api/captain/tables"),
      fetch("/api/captain/orders"),
    ]);
    if (tableRes.ok) {
      const body = (await tableRes.json()) as { data?: RestaurantTable[] };
      if (body.data) setTables(body.data);
    }
    if (orderRes.ok) {
      const body = (await orderRes.json()) as { data?: OrderSummary[] };
      if (body.data) setOrders(body.data);
    }
  }

  const tableOf = (id: string) => tables.find((table) => table.id === id) ?? null;

  const visible = useMemo(() => {
    const chosen = FILTERS.find((entry) => entry.id === filter);
    const rows = tables.filter((table) => table.isActive && (!chosen?.match || chosen.match.includes(table.status)));
    return groupTablesBySection(rows);
  }, [tables, filter]);

  function openTable(table: RestaurantTable) {
    setError("");
    if (table.status === "OPEN" || table.status === "CLEANING") {
      setView({ kind: "guests", tableId: table.id, count: table.capacity && table.capacity <= 10 ? table.capacity : 2 });
      return;
    }
    if (table.status === "OCCUPIED") {
      setCart([]);
      setView({ kind: "order", tableId: table.id });
      return;
    }
    setView({ kind: "detail", tableId: table.id });
  }

  async function confirmGuests() {
    if (view.kind !== "guests") return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/captain/tables/${view.tableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "START_SERVICE", guestCount: view.count }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; data?: RestaurantTable };
    setBusy(false);
    if (!response.ok && response.status !== 409) {
      setError(body.error || "Could not open the table.");
      return;
    }
    if (body.data) setTables((current) => current.map((table) => (table.id === body.data!.id ? body.data! : table)));
    setCart([]);
    setView({ kind: "order", tableId: view.tableId });
  }

  function addDish(dish: MenuDish, variant?: { id: string; name: string; price: number }) {
    if (dish.variants.length > 0 && !variant) return;
    setCart((current) => {
      const key = `${dish.id}:${variant?.id ?? ""}`;
      const existing = current.find((line) => line.key === key && !line.note);
      if (existing) {
        return current.map((line) => (line.key === key && !line.note ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [
        ...current,
        {
          key: `${key}:${crypto.randomUUID()}`,
          dishId: dish.id,
          name: variant ? `${dish.name} (${variant.name})` : dish.name,
          variantId: variant?.id,
          variantName: variant?.name,
          quantity: 1,
          note: "",
        },
      ];
    });
  }

  async function sendKot() {
    if (view.kind !== "order" || cart.length === 0) return;
    const table = tableOf(view.tableId);
    if (!table) return;
    const key = sendKey ?? crypto.randomUUID();
    setSendKey(key);
    setBusy(true);
    setError("");
    const response = await fetch("/api/captain/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tableNumber: table.tableNumber,
        guestCount: table.guestCount,
        idempotencyKey: key,
        sendToKitchen: true,
        items: cart.map((line) => ({
          dishId: line.dishId,
          variantId: line.variantId,
          quantity: line.quantity,
          note: line.note.trim() || undefined,
          selections: [],
        })),
      }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; data?: OrderSummary };
    setBusy(false);
    if (!response.ok || !body.data) {
      setError(body.error || "Could not send the KOT.");
      return;
    }
    setSendKey(null);
    const sent = cart.map((line) => ({ name: line.name, quantity: line.quantity, note: line.note.trim() || undefined }));
    const kotNumber = body.data.items.reduce((max, item) => Math.max(max, item.kotNumber ?? 1), 1);
    setOrders((current) => {
      const rest = current.filter((order) => order.id !== body.data!.id);
      return [body.data!, ...rest];
    });
    setCart([]);
    setView({
      kind: "kot",
      tableId: table.id,
      kotNumber,
      lines: sent,
      at: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    });
    void refresh();
  }

  async function setGuests(tableId: string, guestCount: number) {
    const response = await fetch(`/api/captain/tables/${tableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SET_GUEST_COUNT", guestCount }),
    });
    const body = (await response.json().catch(() => ({}))) as { data?: RestaurantTable; error?: string };
    if (!response.ok) {
      setError(body.error || "Could not update guests.");
      return;
    }
    if (body.data) setTables((current) => current.map((table) => (table.id === tableId ? body.data! : table)));
  }

  async function requestBill(tableId: string) {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/captain/tables/${tableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "REQUEST_BILL" }),
    });
    const body = (await response.json().catch(() => ({}))) as { data?: RestaurantTable; error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Could not request the bill.");
      return;
    }
    if (body.data) setTables((current) => current.map((table) => (table.id === tableId ? body.data! : table)));
  }

  async function recordPayment(order: OrderSummary, method: "CASH" | "UPI" | "CARD") {
    setBusy(true);
    setError("");
    const store = browserPaymentStore();
    const idempotencyKey = paymentAttemptKey(order.id, store);
    const response = await fetch(`/api/orders/${order.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, idempotencyKey }),
    });
    const body = (await response.json().catch(() => ({}))) as { error?: string; data?: OrderSummary };
    setBusy(false);
    if (!response.ok || !body.data) {
      setError(typeof body.error === "string" ? body.error : "Payment was not recorded.");
      return;
    }
    clearPaymentAttempt(order.id, store);
    setOrders((current) => current.map((entry) => (entry.id === body.data!.id ? body.data! : entry)));
  }

  const shownDishes = dishes.filter((dish) => {
    const inCategory = categoryId === "all" || dish.categoryId === categoryId;
    const named = dish.name.toLowerCase().includes(query.trim().toLowerCase());
    return inCategory && named;
  });

  const currentTable = view.kind === "grid" ? null : tableOf(view.tableId);
  const currentOrder = currentTable ? activeOrder(orders, currentTable.tableNumber) : null;
  const canPay = (["CASH", "UPI", "CARD"] as const).filter((method) => captainMayRecordPayment(gates, method));

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-sheet, .print-sheet * { visibility: visible; }
          .print-sheet { position: absolute; left: 0; top: 0; width: 80mm; }
          .no-print { display: none !important; }
        }
      `}</style>

      {view.kind === "grid" ? (
        <>
          <header>
            <p className="text-xs font-bold uppercase tracking-widest text-neutral-500">{captainName}</p>
            <h1 className="text-3xl font-black">Tables</h1>
          </header>
          <div className="no-print flex gap-2 overflow-x-auto pb-1">
            {FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setFilter(entry.id)}
                className={`min-h-12 shrink-0 rounded-full px-5 text-base font-bold ${
                  filter === entry.id ? "bg-neutral-900 text-white" : "bg-white text-neutral-800"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>
          {visible.map((group) => (
            <section key={group.name}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-neutral-500">{group.name}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {group.tables.map((table) => {
                  const order = activeOrder(orders, table.tableNumber);
                  const occupied = table.status !== "OPEN" && table.status !== "CLEANING" && table.status !== "CLOSED";
                  const since = table.occupiedSince || order?.createdAt;
                  return (
                    <button
                      key={table.id}
                      type="button"
                      onClick={() => openTable(table)}
                      className={`min-h-36 rounded-3xl border p-4 text-left ${CARD[table.status]}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-4xl font-black tabular-nums">{table.tableNumber}</span>
                        <span className="text-xs font-bold uppercase">{LABEL[table.status]}</span>
                      </div>
                      {occupied ? (
                        <p className="mt-3 text-sm font-semibold leading-5">
                          {table.guestCount ?? order?.guestCount ?? "—"} guests
                          <br />
                          {order ? formatRupeeTotal(order.total) : "₹—"}
                          <br />
                          {formatOccupiedDuration(since, now)}
                        </p>
                      ) : (
                        <p className="mt-3 text-sm font-semibold">Tap to open</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      ) : null}

      {view.kind === "guests" && currentTable ? (
        <section className="mx-auto max-w-md space-y-4">
          <h1 className="text-3xl font-black">Table {currentTable.tableNumber}</h1>
          <p className="text-lg">How many guests?</p>
          <p className="text-6xl font-black tabular-nums">{view.count}</p>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, index) => index + 1).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setView({ kind: "guests", tableId: view.tableId, count })}
                className={`min-h-16 rounded-2xl text-2xl font-black ${
                  view.count === count ? "bg-neutral-900 text-white" : "bg-white"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirmGuests()}
            className="min-h-16 w-full rounded-2xl bg-emerald-600 text-xl font-black text-white"
          >
            {busy ? "Opening…" : "Start order"}
          </button>
          <button type="button" onClick={() => setView({ kind: "grid" })} className="min-h-12 w-full text-base font-bold">
            Back
          </button>
        </section>
      ) : null}

      {view.kind === "order" && currentTable ? (
        <section className="space-y-3 pb-28">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-3xl font-black">Table {currentTable.tableNumber}</h1>
            <button
              type="button"
              onClick={() => setView({ kind: "detail", tableId: currentTable.id })}
              className="min-h-12 rounded-full bg-white px-4 text-sm font-bold"
            >
              Bill
            </button>
          </div>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search items"
            className="min-h-14 w-full rounded-2xl border border-neutral-200 px-4 text-lg"
          />
          <div className="flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setCategoryId("all")}
              className={`min-h-12 shrink-0 rounded-full px-4 font-bold ${categoryId === "all" ? "bg-neutral-900 text-white" : "bg-white"}`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                className={`min-h-12 shrink-0 rounded-full px-4 font-bold ${
                  categoryId === category.id ? "bg-neutral-900 text-white" : "bg-white"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
          <div className="grid gap-2">
            {shownDishes.map((dish) => (
              <div key={dish.id} className="rounded-2xl bg-white p-3">
                {dish.variants.length === 0 ? (
                  <button type="button" onClick={() => addDish(dish)} className="min-h-14 w-full text-left text-lg font-bold">
                    {dish.name}
                  </button>
                ) : (
                  <div>
                    <p className="text-lg font-bold">{dish.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {dish.variants.map((variant) => (
                        <button
                          key={variant.id}
                          type="button"
                          onClick={() => addDish(dish, variant)}
                          className="min-h-12 rounded-full bg-neutral-100 px-4 font-bold"
                        >
                          {variant.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {cart.length > 0 ? (
            <div className="space-y-3 rounded-3xl bg-white p-4">
              {cart.map((line) => (
                <div key={line.key} className="space-y-2 border-b border-neutral-100 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{line.name}</p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease ${line.name}`}
                        onClick={() =>
                          setCart((current) =>
                            current
                              .map((entry) => (entry.key === line.key ? { ...entry, quantity: entry.quantity - 1 } : entry))
                              .filter((entry) => entry.quantity > 0),
                          )
                        }
                        className="h-12 w-12 rounded-full bg-neutral-100 text-2xl font-black"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-xl font-black">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${line.name}`}
                        onClick={() =>
                          setCart((current) =>
                            current.map((entry) =>
                              entry.key === line.key ? { ...entry, quantity: entry.quantity + 1 } : entry,
                            ),
                          )
                        }
                        className="h-12 w-12 rounded-full bg-neutral-900 text-2xl font-black text-white"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    value={line.note}
                    onChange={(event) =>
                      setCart((current) =>
                        current.map((entry) => (entry.key === line.key ? { ...entry, note: event.target.value } : entry)),
                      )
                    }
                    placeholder="Note for kitchen"
                    className="min-h-12 w-full rounded-xl border border-neutral-200 px-3"
                  />
                </div>
              ))}
            </div>
          ) : null}
          <div className="no-print fixed inset-x-0 bottom-16 z-30 px-4 lg:bottom-4">
            <button
              type="button"
              disabled={busy || cart.length === 0}
              onClick={() => void sendKot()}
              className="min-h-16 w-full rounded-2xl bg-neutral-900 text-xl font-black text-white disabled:opacity-40"
            >
              {busy ? "Sending…" : "Send KOT"}
            </button>
          </div>
          <button type="button" onClick={() => setView({ kind: "grid" })} className="min-h-12 font-bold">
            Back to tables
          </button>
        </section>
      ) : null}

      {view.kind === "kot" && currentTable ? (
        <section>
          <article className="print-sheet mx-auto w-[80mm] bg-white p-4 font-mono text-black">
            <p className="text-center text-xs tracking-widest">KITCHEN TICKET</p>
            <p className="text-center text-2xl font-black">KOT {view.kotNumber}</p>
            <p className="text-center text-sm">Table {currentTable.tableNumber}</p>
            <p className="text-center text-sm">{captainName}</p>
            <p className="text-center text-sm">{view.at}</p>
            <hr className="my-2 border-dashed" />
            {view.lines.map((line, index) => (
              <p key={`${line.name}-${index}`} className="text-sm">
                {line.quantity}  {line.name}
                {line.note ? <span className="block pl-4">Note: {line.note}</span> : null}
              </p>
            ))}
            <p className="mt-3 text-center text-[10px]">Browser print. No printer hardware is connected.</p>
          </article>
          <div className="no-print mt-4 flex gap-2">
            <button type="button" onClick={() => window.print()} className="min-h-14 flex-1 rounded-2xl bg-neutral-900 font-black text-white">
              Reprint
            </button>
            <button
              type="button"
              onClick={() => setView({ kind: "order", tableId: currentTable.id })}
              className="min-h-14 flex-1 rounded-2xl bg-white font-black"
            >
              Add more
            </button>
          </div>
        </section>
      ) : null}

      {view.kind === "detail" && currentTable ? (
        <section className="space-y-4">
          <h1 className="text-3xl font-black">Table {currentTable.tableNumber}</h1>
          <div className="rounded-3xl bg-white p-4">
            <p className="text-sm font-bold uppercase text-neutral-500">Guests</p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void setGuests(currentTable.id, Math.max(1, (currentTable.guestCount ?? 1) - 1))}
                className="h-14 w-14 rounded-full bg-neutral-100 text-2xl font-black"
              >
                −
              </button>
              <span className="text-4xl font-black">{currentTable.guestCount ?? "—"}</span>
              <button
                type="button"
                onClick={() => void setGuests(currentTable.id, Math.min(100, (currentTable.guestCount ?? 0) + 1))}
                className="h-14 w-14 rounded-full bg-neutral-900 text-2xl font-black text-white"
              >
                +
              </button>
            </div>
            <p className="mt-3 text-sm">
              Opened {currentTable.occupiedSince ? new Date(currentTable.occupiedSince).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"}
              {" · "}
              {formatOccupiedDuration(currentTable.occupiedSince || currentOrder?.createdAt, now)}
            </p>
          </div>
          {currentOrder ? (
            <>
              {Object.entries(
                currentOrder.items.reduce<Record<string, typeof currentOrder.items>>((groups, item) => {
                  const key = String(item.kotNumber ?? 1);
                  groups[key] = [...(groups[key] ?? []), item];
                  return groups;
                }, {}),
              ).map(([kot, lines]) => (
                <div key={kot} className="rounded-3xl bg-white p-4">
                  <p className="font-black">KOT {kot}</p>
                  {lines.map((line) => (
                    <p key={line.lineId ?? line.dishNameSnapshot} className="text-sm">
                      {line.quantity} × {line.dishNameSnapshot}
                      {line.note ? ` — ${line.note}` : ""}
                    </p>
                  ))}
                </div>
              ))}
              {gates.viewBill ? (
                <div className="rounded-3xl bg-white p-4 text-lg">
                  <p>Subtotal {formatRupeeTotal(runningBillFromServer(currentOrder).subtotal)}</p>
                  <p>Tax {formatRupeeTotal(runningBillFromServer(currentOrder).tax)}</p>
                  <p className="text-2xl font-black">Total {formatRupeeTotal(runningBillFromServer(currentOrder).total)}</p>
                </div>
              ) : (
                <p className="rounded-3xl bg-white p-4 font-bold">Bill is hidden for this captain.</p>
              )}
            </>
          ) : (
            <p className="rounded-3xl bg-white p-4">No running order.</p>
          )}
          <div className="grid gap-2">
            {gates.requestBill ? (
              <button
                type="button"
                disabled={busy || !currentOrder}
                onClick={() => void requestBill(currentTable.id)}
                className="min-h-14 rounded-2xl bg-violet-700 font-black text-white disabled:opacity-40"
              >
                Request bill
              </button>
            ) : null}
            {gates.printReceipt && currentOrder ? (
              <button
                type="button"
                onClick={() => setView({ kind: "bill", tableId: currentTable.id })}
                className="min-h-14 rounded-2xl bg-white font-black"
              >
                Print bill
              </button>
            ) : null}
            {canPay.length > 0 && currentOrder
              ? canPay.map((method) => (
                  <button
                    key={method}
                    type="button"
                    disabled={busy}
                    onClick={() => void recordPayment(currentOrder, method)}
                    className="min-h-14 rounded-2xl bg-neutral-900 font-black text-white"
                  >
                    Take {method.toLowerCase()} payment
                  </button>
                ))
              : null}
            <button
              type="button"
              onClick={() => setView({ kind: "order", tableId: currentTable.id })}
              className="min-h-14 rounded-2xl bg-emerald-600 font-black text-white"
            >
              Add items
            </button>
            <button type="button" onClick={() => setView({ kind: "grid" })} className="min-h-12 font-bold">
              Back to tables
            </button>
          </div>
        </section>
      ) : null}

      {view.kind === "bill" && currentTable && currentOrder && gates.viewBill ? (
        <section>
          <article className="print-sheet mx-auto w-[80mm] bg-white p-4 font-mono text-black">
            <p className="text-center text-xs tracking-widest">BILL</p>
            <p className="text-center text-xl font-black">Table {currentTable.tableNumber}</p>
            <p className="text-center text-sm">Order {currentOrder.orderNumber}</p>
            <hr className="my-2 border-dashed" />
            {currentOrder.items.map((line) => (
              <p key={line.lineId ?? line.dishNameSnapshot} className="flex justify-between text-sm">
                <span>
                  {line.quantity} {line.dishNameSnapshot}
                </span>
                <span>{formatRupeeTotal(line.itemTotal)}</span>
              </p>
            ))}
            <hr className="my-2 border-dashed" />
            <p className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>{formatRupeeTotal(runningBillFromServer(currentOrder).subtotal)}</span>
            </p>
            <p className="flex justify-between text-sm">
              <span>Tax</span>
              <span>{formatRupeeTotal(runningBillFromServer(currentOrder).tax)}</span>
            </p>
            <p className="flex justify-between text-base font-black">
              <span>Total</span>
              <span>{formatRupeeTotal(runningBillFromServer(currentOrder).total)}</span>
            </p>
            <p className="mt-3 text-center text-[10px]">Browser print. No printer hardware is connected.</p>
          </article>
          <div className="no-print mt-4 flex gap-2">
            <button type="button" onClick={() => window.print()} className="min-h-14 flex-1 rounded-2xl bg-neutral-900 font-black text-white">
              Print
            </button>
            <button
              type="button"
              onClick={() => setView({ kind: "detail", tableId: currentTable.id })}
              className="min-h-14 flex-1 rounded-2xl bg-white font-black"
            >
              Back
            </button>
          </div>
        </section>
      ) : null}

      {error ? <p className="no-print rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-800">{error}</p> : null}
      <p className="sr-only">Outlet {slug}</p>
    </div>
  );
}
