"use client";

import { useEffect, useState } from "react";

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
        { label: "Customers", value: String(data.customers.customerCount) },
        { label: "Repeat guests", value: String(data.customers.repeatCustomerCount) },
      ]
    : [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <p className="text-xs uppercase tracking-[0.18em] text-neutral-500">Reports</p>
        <h1 className="font-serif text-3xl text-neutral-900">{restaurantName}</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Consistent definitions: gross sales exclude cancelled/rejected orders; stock value uses average unit cost.
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
    </div>
  );
}
