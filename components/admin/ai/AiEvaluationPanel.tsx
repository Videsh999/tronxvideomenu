"use client";

import { useState } from "react";

type Snapshot = {
  generatedAt: string;
  financial: { pass: number; fail: number; rows: { metric: string; expected: number; calculated: number; difference: number; pass: boolean; explanation: string }[] };
  assistant: { pass: number; fail: number; results: { id: string; pass: boolean; detail: string }[] };
  forecast: {
    figuresSource: string;
    wapeRevenue: number | null;
    maeRevenue: number | null;
    biasRevenue: number | null;
    baselineWeekdayWape: number | null;
    baselineMaWape: number | null;
    intervalCoverage: number | null;
    testFrom: string;
    testTo: string;
    note?: string;
    days?: unknown[];
  };
  inventory: { pass: number; fail: number };
  menu: { pass: number; fail: number };
  alerts: { pass: number; fail: number };
  security: { pass: number; fail: number };
  provider: { pass: number; fail: number };
};

type Usage = {
  since: string;
  requestCount: number;
  estimatedCostUsd: number;
  estimatedTokens: number;
  byRoute: Record<string, number>;
};

function Status({ pass, fail }: { pass: number; fail: number }) {
  if (fail > 0) return <span className="text-rose-700 font-semibold">Failed ({fail})</span>;
  if (pass > 0) return <span className="text-emerald-700 font-semibold">Passed ({pass})</span>;
  return <span className="text-amber-700 font-semibold">Insufficient data</span>;
}

export default function AiEvaluationPanel() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const [evalRes, usageRes] = await Promise.all([
        fetch("/api/ai/evaluation", { cache: "no-store" }),
        fetch("/api/ai/usage", { cache: "no-store" }),
      ]);
      const evalJson = (await evalRes.json()) as { success: boolean; data?: Snapshot; error?: string };
      const usageJson = (await usageRes.json()) as { success: boolean; data?: Usage; error?: string };
      if (!evalRes.ok || !evalJson.success || !evalJson.data) {
        throw new Error(evalJson.error ?? "Evaluation failed");
      }
      setSnap(evalJson.data);
      if (usageRes.ok && usageJson.success && usageJson.data) setUsage(usageJson.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Evaluation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Automated validation against deterministic fixtures and chronological backtests. Results are
        real suite outcomes — not decorative status lights.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void run()}
        className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Running evaluation…" : "Run evaluation suite"}
      </button>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {snap ? (
        <div className="space-y-4">
          <p className="text-xs text-neutral-500">Last run: {new Date(snap.generatedAt).toLocaleString()}</p>
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Financial reconciliation</h2>
            <p className="text-sm">
              <Status pass={snap.financial.pass} fail={snap.financial.fail} />
            </p>
            <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-neutral-600">
              {snap.financial.rows.map((row) => (
                <li key={row.metric}>
                  {row.metric}: expected {row.expected} · calc {row.calculated} · Δ {row.difference} ·{" "}
                  {row.pass ? "pass" : "FAIL"}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Assistant golden tests</h2>
            <p className="text-sm">
              <Status pass={snap.assistant.pass} fail={snap.assistant.fail} />
            </p>
            <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-neutral-600">
              {snap.assistant.results.map((row) => (
                <li key={row.id}>
                  {row.id}: {row.pass ? "pass" : "FAIL"} — {row.detail}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <h2 className="text-sm font-semibold">Forecast backtest ({snap.forecast.figuresSource})</h2>
            {snap.forecast.figuresSource === "INSUFFICIENT_DATA" ? (
              <p className="text-sm text-amber-800">{snap.forecast.note}</p>
            ) : (
              <ul className="mt-2 text-sm text-neutral-700">
                <li>
                  Period {snap.forecast.testFrom} → {snap.forecast.testTo}
                </li>
                <li>WAPE revenue: {snap.forecast.wapeRevenue ?? "n/a"}</li>
                <li>MAE revenue: {snap.forecast.maeRevenue ?? "n/a"}</li>
                <li>Bias revenue: {snap.forecast.biasRevenue ?? "n/a"}</li>
                <li>Baseline weekday WAPE: {snap.forecast.baselineWeekdayWape ?? "n/a"}</li>
                <li>Baseline MA WAPE: {snap.forecast.baselineMaWape ?? "n/a"}</li>
                <li>p10–p90 coverage: {snap.forecast.intervalCoverage ?? "n/a"}</li>
                <li>Days evaluated: {snap.forecast.days?.length ?? 0}</li>
              </ul>
            )}
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
              <h2 className="font-semibold">Inventory checks</h2>
              <Status pass={snap.inventory.pass} fail={snap.inventory.fail} />
            </section>
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
              <h2 className="font-semibold">Menu checks</h2>
              <Status pass={snap.menu.pass} fail={snap.menu.fail} />
            </section>
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
              <h2 className="font-semibold">Alert checks</h2>
              <Status pass={snap.alerts.pass} fail={snap.alerts.fail} />
            </section>
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
              <h2 className="font-semibold">Security / provider</h2>
              <Status pass={snap.security.pass} fail={snap.security.fail} /> ·{" "}
              <Status pass={snap.provider.pass} fail={snap.provider.fail} />
            </section>
          </div>
          {usage ? (
            <section className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
              <h2 className="font-semibold">AI usage (last 30 days)</h2>
              <p>
                Requests {usage.requestCount} · est. tokens {usage.estimatedTokens} · est. cost $
                {usage.estimatedCostUsd}
              </p>
              <ul className="mt-2 text-xs text-neutral-600">
                {Object.entries(usage.byRoute).map(([route, count]) => (
                  <li key={route}>
                    {route}: {count}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
