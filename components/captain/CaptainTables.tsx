"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { OrderSummary, RestaurantTable } from "@/types";
import { enrichCaptainTables } from "@/lib/captain-floor";
import RememberCaptainScreen from "@/components/captain/RememberCaptainScreen";
import { locationName, locationType } from "@/lib/service-location";

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function CaptainTables({
  slug,
  initialTables,
  initialOrders,
  assignedTableIds,
  currency = "INR",
}: {
  slug: string;
  initialTables: RestaurantTable[];
  initialOrders: OrderSummary[];
  assignedTableIds: string[];
  currency?: string;
}) {
  const [kind, setKind] = useState<"TABLE" | "ROOM">("TABLE");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const rows = useMemo(
    () => enrichCaptainTables(initialTables, initialOrders, new Set(assignedTableIds)),
    [initialTables, initialOrders, assignedTableIds],
  );
  const kindRows = rows.filter(({ table }) => locationType(table) === kind);
  const visibleRows = kindRows.filter(({ table }) => {
    const query = search.trim().toLowerCase();
    if (!query) return true;
    return (
      String(table.tableNumber).includes(query) ||
      (table.label ?? "").toLowerCase().includes(query)
    );
  });

  void now;

  return (
    <div className="space-y-4 pb-4">
      <RememberCaptainScreen
        path={`/captain/${slug}/tables`}
        snap={{
          kind: "tables",
          cards: visibleRows.slice(0, 24).map(({ table, activeOrder, runningTotal }) => ({
            name: locationName(table),
            detail: activeOrder ? money(runningTotal, currency) : "Free",
          })),
        }}
      />

      <header className="space-y-1">
        <h1 className="text-3xl font-black tracking-tight">My tables</h1>
        <p className="text-base text-neutral-600">Tap a table. Then add food.</p>
      </header>

      <div className="flex gap-2">
        {(["TABLE", "ROOM"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`min-h-12 flex-1 rounded-2xl text-base font-bold ${
              kind === value ? "bg-neutral-900 text-white" : "border border-neutral-200 bg-white text-neutral-700"
            }`}
          >
            {value === "TABLE" ? "Tables" : "Rooms"}
          </button>
        ))}
      </div>

      <label className="relative block">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          inputMode="numeric"
          placeholder="Find table number"
          className="min-h-14 w-full rounded-2xl border border-neutral-200 bg-white pl-11 pr-4 text-lg font-semibold"
        />
      </label>

      {visibleRows.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleRows.map(({ table, activeOrder, runningTotal, unsentItems }) => {
            const busy = Boolean(activeOrder);
            return (
              <Link
                prefetch
                key={table.id}
                href={`/captain/${slug}/tables/${encodeURIComponent(table.id)}`}
                className={`flex min-h-[9.5rem] flex-col rounded-3xl border-2 p-4 shadow-sm transition active:scale-[0.98] ${
                  busy
                    ? "border-amber-300 bg-amber-50"
                    : "border-emerald-200 bg-emerald-50"
                }`}
              >
                <span
                  className={`self-start rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wide ${
                    busy ? "bg-amber-500 text-white" : "bg-emerald-600 text-white"
                  }`}
                >
                  {busy ? "Busy" : "Free"}
                </span>
                <p className="mt-3 text-4xl font-black leading-none text-neutral-900">
                  {table.tableNumber}
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-neutral-600">
                  {table.label?.trim() || (kind === "ROOM" ? "Room" : "Table")}
                </p>
                <p className="mt-auto pt-3 text-base font-black text-neutral-900">
                  {busy ? money(runningTotal, currency) : "Tap to start"}
                </p>
                {unsentItems > 0 ? (
                  <p className="mt-1 text-xs font-bold text-amber-800">
                    Kitchen waiting: {unsentItems}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <p className="rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center text-base text-neutral-500">
          No tables found. Ask the owner to assign tables to you.
        </p>
      )}
    </div>
  );
}
