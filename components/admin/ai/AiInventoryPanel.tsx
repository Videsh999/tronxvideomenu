"use client";

import { useState } from "react";

type Rec = {
  ingredientId: string;
  name: string;
  currentStock: number;
  predictedDemand: number;
  pendingInbound: number;
  suggestedReorder: number;
  daysOfCover: number | null;
  stockoutRisk: boolean;
  figuresSource: string;
  reason: string;
};

export default function AiInventoryPanel() {
  const [rows, setRows] = useState<Rec[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/ai/inventory", { cache: "no-store" });
      const json = (await response.json()) as {
        success: boolean;
        data?: { recommendations: Rec[]; note?: string };
        error?: string;
      };
      if (!response.ok || !json.success || !json.data) throw new Error(json.error ?? "Failed");
      setRows(json.data.recommendations);
      setNote(json.data.note ?? "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={loading}
        onClick={() => void load()}
        className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
      >
        {loading ? "Analyzing…" : "Run inventory intelligence"}
      </button>
      {note ? <p className="text-sm text-neutral-600">{note}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.ingredientId} className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
            <div className="font-semibold text-neutral-900">
              {row.name} {row.stockoutRisk ? "· risk" : ""}
            </div>
            <div className="mt-1 text-neutral-600">
              On hand {row.currentStock} · demand {row.predictedDemand} · inbound {row.pendingInbound} · suggest{" "}
              {row.suggestedReorder}
            </div>
            <p className="mt-2 text-xs text-neutral-500">
              {row.figuresSource}: {row.reason}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
