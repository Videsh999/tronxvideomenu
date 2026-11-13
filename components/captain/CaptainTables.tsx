"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Clock3, Search, UtensilsCrossed } from "lucide-react";
import type { OrderSummary, RestaurantTable } from "@/types";
import { enrichCaptainTables } from "@/lib/captain-floor";
import { locationName, locationType } from "@/lib/service-location";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function elapsed(iso: string | undefined, now: number) {
  if (!iso) return null;
  const minutes = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr ${minutes % 60} min`;
}

export default function CaptainTables({ slug, initialTables, initialOrders, assignedTableIds, currency = "INR" }: {
  slug: string;
  initialTables: RestaurantTable[];
  initialOrders: OrderSummary[];
  assignedTableIds: string[];
  currency?: string;
}) {
  const [kind, setKind] = useState<"TABLE" | "ROOM">("TABLE");
  const [area, setArea] = useState("ALL");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const rows = useMemo(() => enrichCaptainTables(initialTables, initialOrders, new Set(assignedTableIds)), [initialTables, initialOrders, assignedTableIds]);
  const kindRows = rows.filter(({ table }) => locationType(table) === kind);
  const areaFor = (table: RestaurantTable) => table.label?.trim() || (kind === "ROOM" ? "Rooms" : "Main floor");
  const areas = [...new Set(kindRows.map(({ table }) => areaFor(table)))].sort();
  const visibleRows = kindRows.filter(({ table }) => {
    const query = search.trim().toLowerCase();
    return (area === "ALL" || area === areaFor(table)) && (!query || String(table.tableNumber).includes(query) || areaFor(table).toLowerCase().includes(query));
  });

  return <div className="space-y-5">
    <header><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tables</h1><p className="mt-1 text-sm text-neutral-500">Choose the guest’s table. Every item, KOT and bill stays with that table until you finish it.</p></header>
    <div className="flex flex-wrap items-center gap-2">
      {(["TABLE", "ROOM"] as const).map((value) => <button key={value} type="button" onClick={() => { setKind(value); setArea("ALL"); }} className={`min-h-11 rounded-xl px-4 text-sm font-bold ${kind === value ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700"}`}>{value === "TABLE" ? "Tables" : "Rooms"} ({rows.filter(({ table }) => locationType(table) === value).length})</button>)}
      <label className="relative min-w-48 flex-1 sm:max-w-72"><Search className="absolute left-3 top-3.5 h-4 w-4 text-neutral-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find table or area" className="min-h-11 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm" /></label>
    </div>
    <nav aria-label="Areas" className="flex gap-2 overflow-x-auto pb-1">{["ALL", ...areas].map((value) => <button key={value} type="button" onClick={() => setArea(value)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold ${area === value ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700"}`}>{value === "ALL" ? "All areas" : value}</button>)}</nav>
    {visibleRows.length ? <div className="grid grid-cols-2 gap-3">{visibleRows.map(({ table, activeOrder, activeOrders, runningTotal, unsentItems, startedAt }) => {
      const timer = elapsed(startedAt, now);
      const itemCount = activeOrders.reduce((sum, order) => sum + order.items.reduce((count, item) => count + item.quantity - (item.cancelledQuantity ?? 0), 0), 0);
      return <Link prefetch={false} key={table.id} href={`/captain/${slug}/tables/${encodeURIComponent(table.id)}`} className="group block rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-neutral-900 hover:shadow-md focus-visible:outline-2 focus-visible:outline-neutral-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{areaFor(table)}</p>
        <div className="mt-1 flex items-start justify-between gap-3"><h2 className="text-2xl font-black">{locationName(table)}</h2><span className="text-sm font-bold text-neutral-700">{activeOrder ? money(runningTotal, currency) : "Start order"}</span></div>
        {activeOrder ? <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-600"><span>{itemCount} item{itemCount === 1 ? "" : "s"}</span>{timer ? <span className="inline-flex items-center gap-1"><Clock3 className="h-4 w-4" />{timer}</span> : null}</div> : <p className="mt-3 text-sm text-neutral-500">Tap to take an order</p>}
        {unsentItems > 0 ? <p className="mt-2 text-xs font-semibold text-amber-800">{unsentItems} item{unsentItems === 1 ? "" : "s"} waiting for KOT</p> : null}
        <span className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white group-hover:bg-neutral-800"><UtensilsCrossed className="h-4 w-4" />Open table</span>
      </Link>;
    })}</div> : <p className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">No {kind === "ROOM" ? "rooms" : "tables"} match. Add locations in Admin → Tables &amp; QR.</p>}
  </div>;
}
