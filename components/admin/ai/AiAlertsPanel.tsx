"use client";

import { useState } from "react";
import type { AiAlert } from "@/types";

export default function AiAlertsPanel() {
  const [alerts, setAlerts] = useState<AiAlert[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/alerts", { cache: "no-store" });
      const json = (await response.json()) as {
        success: boolean;
        data?: { alerts: AiAlert[] };
        error?: string;
      };
      if (!response.ok || !json.success || !json.data) throw new Error(json.error ?? "Failed");
      setAlerts(json.data.alerts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "SCAN" }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !json.success) throw new Error(json.error ?? "Scan failed");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Scan failed");
      setBusy(false);
    }
  };

  const setStatus = async (alertId: string, action: "ACKNOWLEDGE" | "RESOLVE" | "DISMISS") => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/ai/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, alertId }),
      });
      const json = (await response.json()) as { success: boolean; error?: string };
      if (!response.ok || !json.success) throw new Error(json.error ?? "Update failed");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Update failed");
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void refresh()}
          className="h-10 rounded-xl border border-neutral-300 px-4 text-sm font-medium disabled:opacity-50"
        >
          Load alerts
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void scan()}
          className="h-10 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          Scan now
        </button>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <ul className="space-y-3">
        {alerts.map((alert) => (
          <li key={alert.id} className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-neutral-900">
                [{alert.severity}] {alert.title}
              </span>
              <span className="text-xs text-neutral-500">{alert.status}</span>
            </div>
            <p className="mt-1 text-neutral-600">{alert.reason}</p>
            <p className="mt-1 text-xs text-neutral-500">{alert.suggestedAction}</p>
            {alert.status === "NEW" ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1 text-xs"
                  onClick={() => void setStatus(alert.id, "ACKNOWLEDGE")}
                >
                  Acknowledge
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1 text-xs"
                  onClick={() => void setStatus(alert.id, "RESOLVE")}
                >
                  Resolve
                </button>
                <button
                  type="button"
                  className="rounded-lg border px-2 py-1 text-xs"
                  onClick={() => void setStatus(alert.id, "DISMISS")}
                >
                  Dismiss
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
