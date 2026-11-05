"use client";

import { useState } from "react";
import type { AiForecastHorizon, AiForecastRun } from "@/types";

export default function AiForecastPanel() {
  const [horizon, setHorizon] = useState<AiForecastHorizon>("NEXT_7_DAYS");
  const [run, setRun] = useState<AiForecastRun | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/ai/forecast?horizon=${horizon}`, { cache: "no-store" });
      const json = (await response.json()) as { success: boolean; data?: AiForecastRun; error?: string };
      if (!response.ok || !json.success || !json.data) throw new Error(json.error ?? "Forecast failed");
      setRun(json.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Forecast failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["TOMORROW", "NEXT_7_DAYS", "NEXT_30_DAYS"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setHorizon(value)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              horizon === value ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-700"
            }`}
          >
            {value.replaceAll("_", " ")}
          </button>
        ))}
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="h-9 rounded-lg bg-neutral-900 px-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Running…" : "Generate"}
        </button>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {run ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-500">
            {run.modelVersion} · {run.figuresSource} · generated {new Date(run.generatedAt).toLocaleString()}
          </p>
          {run.note ? <p className="mt-1 text-sm text-neutral-600">{run.note}</p> : null}
          {run.figuresSource === "INSUFFICIENT_DATA" ? (
            <p className="mt-3 text-sm text-amber-800">Not enough complete historical days to forecast.</p>
          ) : (
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
              {run.points.map((point) => (
                <li key={point.date} className="flex justify-between border-b border-neutral-100 py-1">
                  <span>{point.date}</span>
                  <span>
                    ₹{point.revenueP10}–{point.revenueP90} (p50 ₹{point.revenueP50}) · orders ~
                    {point.orderVolumeP50}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
