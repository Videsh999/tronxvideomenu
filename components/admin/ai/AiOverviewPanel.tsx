"use client";

import { useState } from "react";

type OverviewData = {
  sales: {
    grossSales: number;
    activeOrderCount: number;
    averageTicket: number;
    netSales: number;
  };
  forecast: { figuresSource: string; points: { date: string; revenueP50: number }[]; note?: string } | null;
  stockRisks: { name: string; suggestedReorder: number; reason: string }[];
  menuHighlights: { dishName: string; estimatedGrossMarginPercent: number | null }[];
  alerts: { title: string; severity: string; reason: string }[];
};

export default function AiOverviewPanel() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/overview", { cache: "no-store" });
      const json = (await response.json()) as { success: boolean; data?: OverviewData; error?: string };
      if (!response.ok || !json.success || !json.data) throw new Error(json.error ?? "Failed to load overview");
      setData(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const forecastTotal = data?.forecast?.points.reduce((sum, p) => sum + p.revenueP50, 0) ?? null;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => void load()}
        disabled={loading}
        className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Loading…" : data ? "Refresh overview" : "Load overview"}
      </button>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {!data && !error ? (
        <p className="text-sm text-neutral-500">Load the overview to see today’s AI snapshot for this outlet.</p>
      ) : null}
      {data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-900">Today</h2>
            <p className="mt-2 text-2xl font-semibold text-neutral-900">₹{data.sales.grossSales.toFixed(2)}</p>
            <p className="text-xs text-neutral-500">
              {data.sales.activeOrderCount} orders · avg ₹{data.sales.averageTicket.toFixed(2)} · net ledger ₹
              {data.sales.netSales.toFixed(2)}
            </p>
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-900">7-day forecast (p50)</h2>
            {forecastTotal == null ? (
              <p className="mt-2 text-sm text-neutral-500">Forecast unavailable on this plan.</p>
            ) : (
              <>
                <p className="mt-2 text-2xl font-semibold text-neutral-900">₹{forecastTotal.toFixed(2)}</p>
                <p className="text-xs text-neutral-500">
                  {data.forecast?.figuresSource} · {data.forecast?.note ?? "Estimated"}
                </p>
              </>
            )}
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-900">Stock risks</h2>
            <ul className="mt-2 space-y-2 text-sm text-neutral-700">
              {data.stockRisks.length === 0 ? (
                <li className="text-neutral-500">No predicted stockouts.</li>
              ) : (
                data.stockRisks.map((row) => (
                  <li key={row.name}>
                    <span className="font-medium">{row.name}</span> — suggest {row.suggestedReorder}
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-neutral-900">Menu stars & alerts</h2>
            <ul className="mt-2 space-y-1 text-sm text-neutral-700">
              {data.menuHighlights.map((dish) => (
                <li key={dish.dishName}>
                  {dish.dishName}
                  {dish.estimatedGrossMarginPercent != null
                    ? ` · ~${dish.estimatedGrossMarginPercent}% est. margin`
                    : ""}
                </li>
              ))}
              {data.alerts.map((alert) => (
                <li key={alert.title} className="text-amber-800">
                  [{alert.severity}] {alert.title}
                </li>
              ))}
              {!data.menuHighlights.length && !data.alerts.length ? (
                <li className="text-neutral-500">No highlights yet.</li>
              ) : null}
            </ul>
          </section>
        </div>
      ) : null}
    </div>
  );
}
