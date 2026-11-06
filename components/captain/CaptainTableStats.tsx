"use client";

import { useEffect, useState } from "react";

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

export default function CaptainTableStats() {
  const [rows, setRows] = useState<TableRow[]>([]);
  const [busiest, setBusiest] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/captain/table-stats", { cache: "no-store" });
        const json = await response.json();
        if (!json.success) {
          setError(json.error || "Unable to load table stats");
          return;
        }
        setRows(json.data.tables ?? []);
        setBusiest(json.data.busiestTableNumber ?? null);
      } catch {
        setError("Unable to load table stats");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="space-y-3 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">Floor insights</p>
          <h2 className="mt-1 text-xl font-bold tracking-tight">Which tables order more</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Order volume for your assigned tables only — no guest names or phone numbers.
          </p>
        </div>
        {busiest != null ? (
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900">
            Busiest: T{busiest}
          </span>
        ) : null}
      </div>

      {loading ? <p className="py-6 text-center text-sm text-neutral-500">Loading table stats…</p> : null}
      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}

      {!loading && !error ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-neutral-400">
              <tr>
                <th className="pb-2 pr-3 font-semibold">Table</th>
                <th className="pb-2 pr-3 font-semibold">Orders</th>
                <th className="pb-2 pr-3 font-semibold">Gross</th>
                <th className="pb-2 pr-3 font-semibold">Avg</th>
                <th className="pb-2 pr-3 font-semibold">Top dish</th>
                <th className="pb-2 font-semibold">Last</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-neutral-500">
                    No orders on your tables yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.tableNumber} className="border-t border-neutral-100">
                    <td className="py-2.5 pr-3 font-bold tabular-nums">T{row.tableNumber}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.orderCount}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.grossSales.toFixed(0)}</td>
                    <td className="py-2.5 pr-3 tabular-nums">{row.averageTicket.toFixed(0)}</td>
                    <td className="py-2.5 pr-3">
                      {row.topDishName
                        ? `${row.topDishName}${row.topDishQuantity ? ` ×${row.topDishQuantity}` : ""}`
                        : "—"}
                    </td>
                    <td className="py-2.5 text-neutral-500">
                      {row.lastOrderAt
                        ? new Date(row.lastOrderAt).toLocaleString(undefined, {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
