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

type Dashboard = {
  sales: {
    orderCount: number;
    activeOrderCount: number;
    grossSales: number;
    paidOrders: number;
    averageTicket: number;
  };
  inventory: {
    totalValue: number;
    lowStockCount: number;
    expiringSoonCount: number;
    wastageMovementCount: number;
  };
  purchases: {
    purchaseOrderCount: number;
    outstandingCount: number;
    receivedCount: number;
  };
  customers: {
    customerCount: number;
    vipCount: number;
    marketingOptInCount: number;
    repeatCustomerCount: number;
  };
  tables?: {
    tables: TableRow[];
    busiestTableNumber: number | null;
  };
};

type Props = { restaurantName: string };

export default function ReportsDashboard({ restaurantName }: Props) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/reports/dashboard");
      const json = await response.json();
      if (!json.success) {
        setError(json.error || "Unable to load reports");
        return;
      }
      setData(json.data);
    })();
  }, []);

  const cards = data
    ? [
        { label: "Gross sales", value: data.sales.grossSales.toFixed(2) },
        { label: "Orders", value: String(data.sales.activeOrderCount) },
        { label: "Avg ticket", value: data.sales.averageTicket.toFixed(2) },
        { label: "Stock value", value: data.inventory.totalValue.toFixed(2) },
        { label: "Low stock", value: String(data.inventory.lowStockCount) },
        { label: "Wastage moves", value: String(data.inventory.wastageMovementCount) },
        { label: "Open POs", value: String(data.purchases.outstandingCount) },
        { label: "Loyalty members", value: String(data.customers.customerCount) },
        { label: "Repeat guests", value: String(data.customers.repeatCustomerCount) },
        {
          label: "Busiest table",
          value: data.tables?.busiestTableNumber != null ? `T${data.tables.busiestTableNumber}` : "—",
        },
      ]
    : [];

  const tableRows = data?.tables?.tables ?? [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Reports</p>
        <h1 className="font-serif text-3xl text-neutral-900">{restaurantName}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Operational figures only — table insights never include guest phone or name. Loyalty membership is
          optional for guests.
        </p>
      </header>
      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="text-xs uppercase tracking-wide text-neutral-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">{card.value}</p>
          </div>
        ))}
        {!data && !error ? (
          <p className="col-span-full py-12 text-center text-neutral-500">Loading dashboard…</p>
        ) : null}
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Table performance</h2>
          <p className="text-sm text-neutral-500">
            Which tables get more orders and revenue — useful for floor planning. Sorted by order volume.
          </p>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Table</th>
                <th className="px-4 py-3">Orders</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Avg ticket</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Open unpaid</th>
                <th className="px-4 py-3">Top dish</th>
                <th className="px-4 py-3">Last order</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-neutral-500">
                    No table orders in range yet.
                  </td>
                </tr>
              ) : (
                tableRows.map((row) => (
                  <tr key={row.tableNumber} className="border-t border-neutral-100">
                    <td className="px-4 py-3 font-semibold">T{row.tableNumber}</td>
                    <td className="px-4 py-3 tabular-nums">{row.orderCount}</td>
                    <td className="px-4 py-3 tabular-nums">{row.grossSales.toFixed(2)}</td>
                    <td className="px-4 py-3 tabular-nums">{row.averageTicket.toFixed(2)}</td>
                    <td className="px-4 py-3 tabular-nums">{row.paidOrders}</td>
                    <td className="px-4 py-3 tabular-nums">{row.unpaidOpenOrders}</td>
                    <td className="px-4 py-3">
                      {row.topDishName
                        ? `${row.topDishName}${row.topDishQuantity ? ` ×${row.topDishQuantity}` : ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-500">
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
      </section>
    </div>
  );
}
