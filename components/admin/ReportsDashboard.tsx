"use client";

import { useEffect, useState } from "react";
import { addLocalDays, localDateKey, startOfLocalDayIso } from "@/lib/analytics/period";

type TableRow = {
  tableNumber: number;
  orderCount: number;
  grossSales: number;
  averageTicket: number;
  paidOrders: number;
  unpaidOpenOrders: number;
  lastOrderAt: string | null;
  topDishName: string | null;
  topDishQuantity: number;
};

type DishRow = { dishId: string; dishName: string; quantitySold: number; revenue: number };

type OpenOrder = {
  id: string;
  orderNumber: number;
  tableNumber: number;
  status: string;
  total: number;
  items: string;
};

type Dashboard = {
  sales: {
    orderCount: number;
    activeOrderCount: number;
    grossSales: number;
    paidOrders: number;
    averageTicket: number;
  };
  queue?: {
    pending: number;
    cooking: number;
    ready: number;
    served: number;
    cancelled: number;
  };
  topDishes?: DishRow[];
  openOrders?: OpenOrder[];
  inventory: { lowStockCount: number; totalValue: number };
  customers: { customerCount: number; repeatCustomerCount: number };
  tables?: { tables: TableRow[]; busiestTableNumber: number | null };
};

const RANGES = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "week", label: "7 days" },
] as const;

function rangeBounds(id: (typeof RANGES)[number]["id"]) {
  const zone = "Asia/Kolkata";
  const today = localDateKey(new Date().toISOString(), zone);
  if (id === "yesterday") {
    const day = addLocalDays(today, -1);
    return { from: startOfLocalDayIso(day, zone), to: new Date(new Date(startOfLocalDayIso(today, zone)).getTime() - 1).toISOString() };
  }
  if (id === "week") {
    return { from: startOfLocalDayIso(addLocalDays(today, -6), zone), to: new Date().toISOString() };
  }
  const tomorrow = startOfLocalDayIso(addLocalDays(today, 1), zone);
  return { from: startOfLocalDayIso(today, zone), to: new Date(new Date(tomorrow).getTime() - 1).toISOString() };
}

function rupee(value: number) {
  return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function ReportsDashboard({ restaurantName }: { restaurantName: string }) {
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("today");
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { from, to } = rangeBounds(range);
    const controller = new AbortController();
    void (async () => {
      setError(null);
      const response = await fetch(`/api/reports/dashboard?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { signal: controller.signal });
      const json = await response.json();
      if (!json.success) {
        setError(json.error || "Unable to load reports");
        return;
      }
      setData(json.data);
    })().catch((cause) => {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("Unable to load reports");
    });
    return () => controller.abort();
  }, [range]);

  const queue = data?.queue ?? { pending: 0, cooking: 0, ready: 0, served: 0, cancelled: 0 };
  const queueTotal = Math.max(1, queue.pending + queue.cooking + queue.ready + queue.served + queue.cancelled);
  const steps = [
    { label: "Pending", value: queue.pending, bar: "bg-amber-500" },
    { label: "Cooking", value: queue.cooking, bar: "bg-sky-500" },
    { label: "Ready", value: queue.ready, bar: "bg-emerald-500" },
    { label: "Served", value: queue.served, bar: "bg-neutral-700" },
    { label: "Cancelled", value: queue.cancelled, bar: "bg-rose-400" },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-neutral-500">Owner reports</p>
          <h1 className="text-3xl font-black tracking-tight">{restaurantName}</h1>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          {RANGES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setRange(item.id)}
              className={`h-11 rounded-full px-4 text-sm font-bold ${range === item.id ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-800"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Sales", value: data ? rupee(data.sales.grossSales) : "…" },
          { label: "Orders", value: data ? String(data.sales.activeOrderCount) : "…" },
          { label: "Paid", value: data ? String(data.sales.paidOrders) : "…" },
          { label: "Average bill", value: data ? rupee(data.sales.averageTicket) : "…" },
        ].map((card) => (
          <article key={card.label} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{card.label}</p>
            <p className="mt-2 text-2xl font-black tabular-nums sm:text-3xl">{card.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-6">
        <h2 className="text-lg font-black">Order queue</h2>
        <p className="text-sm text-neutral-500">Where today’s orders are, from the kitchen to the table.</p>
        <ul className="mt-4 space-y-3">
          {steps.map((step) => (
            <li key={step.label}>
              <div className="mb-1 flex items-center justify-between text-sm font-bold">
                <span>{step.label}</span>
                <span className="tabular-nums">{step.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
                <div className={`h-full rounded-full ${step.bar}`} style={{ width: `${Math.round((step.value / queueTotal) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-black">Top selling dishes</h2>
          {(data?.topDishes ?? []).length ? (
            <ol className="mt-3 space-y-2">
              {data!.topDishes!.map((dish, index) => (
                <li key={dish.dishId} className="flex items-center gap-3 rounded-2xl bg-neutral-50 px-3 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-neutral-900 text-sm font-bold text-white">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{dish.dishName}</span>
                    <span className="text-sm text-neutral-500">{dish.quantitySold} sold</span>
                  </span>
                  <span className="font-black tabular-nums">{rupee(dish.revenue)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">Top dishes show up after the first paid order in this range.</p>
          )}
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-4 sm:p-6">
          <h2 className="text-lg font-black">Still open</h2>
          {(data?.openOrders ?? []).length ? (
            <ul className="mt-3 space-y-2">
              {data!.openOrders!.map((order) => (
                <li key={order.id} className="rounded-2xl border border-neutral-100 px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold">Table {order.tableNumber} · #{order.orderNumber}</p>
                    <p className="font-black tabular-nums">{rupee(order.total)}</p>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">{order.status}{order.items ? ` · ${order.items}` : ""}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-neutral-500">No orders are waiting in this range.</p>
          )}
        </section>
      </div>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <article className="rounded-2xl border border-neutral-200 bg-white p-4"><p className="text-xs font-semibold text-neutral-500">Guests</p><p className="mt-1 text-2xl font-black">{data?.customers.customerCount ?? "…"}</p></article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-4"><p className="text-xs font-semibold text-neutral-500">Repeat guests</p><p className="mt-1 text-2xl font-black">{data?.customers.repeatCustomerCount ?? "…"}</p></article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-4"><p className="text-xs font-semibold text-neutral-500">Low stock</p><p className="mt-1 text-2xl font-black">{data?.inventory.lowStockCount ?? "…"}</p></article>
        <article className="rounded-2xl border border-neutral-200 bg-white p-4"><p className="text-xs font-semibold text-neutral-500">Busiest table</p><p className="mt-1 text-2xl font-black">{data?.tables?.busiestTableNumber != null ? data.tables.busiestTableNumber : "—"}</p></article>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-black">Tables</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.tables?.tables ?? []).length === 0 ? (
            <p className="text-sm text-neutral-500">No table orders in this range yet.</p>
          ) : data!.tables!.tables.map((row) => (
            <article key={row.tableNumber} className="rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <h3 className="text-xl font-black">Table {row.tableNumber}</h3>
                <p className="font-black tabular-nums">{rupee(row.grossSales)}</p>
              </div>
              <p className="mt-1 text-sm text-neutral-500">{row.orderCount} orders · {row.unpaidOpenOrders} still unpaid</p>
              <p className="mt-2 text-sm font-semibold">{row.topDishName ? `Top: ${row.topDishName}` : "No dish yet"}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
