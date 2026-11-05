"use client";

import { useState } from "react";

type Dish = {
  dishId: string;
  dishName: string;
  quantitySold: number;
  revenue: number;
  classification: string;
  estimatedGrossMarginPercent: number | null;
  explanation: string;
  figuresSource: string;
};

export default function AiMenuPanel() {
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const to = new Date().toISOString();
      const from = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const response = await fetch(
        `/api/ai/menu?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { cache: "no-store" },
      );
      const json = (await response.json()) as {
        success: boolean;
        data?: { dishes: Dish[]; note?: string };
        error?: string;
      };
      if (!response.ok || !json.success || !json.data) throw new Error(json.error ?? "Failed");
      setDishes(json.data.dishes);
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
        {loading ? "Analyzing…" : "Analyze menu (30 days)"}
      </button>
      {note ? <p className="text-sm text-neutral-600">{note}</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <ul className="space-y-2">
        {dishes.map((dish) => (
          <li key={dish.dishId} className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-neutral-900">{dish.dishName}</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-semibold">
                {dish.classification}
              </span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              qty {dish.quantitySold} · ₹{dish.revenue}
              {dish.estimatedGrossMarginPercent != null
                ? ` · est. margin ${dish.estimatedGrossMarginPercent}%`
                : ""}{" "}
              · {dish.figuresSource}
            </p>
            <p className="mt-1 text-xs text-neutral-600">{dish.explanation}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
