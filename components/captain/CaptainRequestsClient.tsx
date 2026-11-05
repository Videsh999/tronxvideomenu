"use client";

import { useState, useTransition } from "react";
import type { ServiceRequest } from "@/types/service-request";

export default function CaptainRequestsClient({
  initialRequests,
}: {
  initialRequests: ServiceRequest[];
}) {
  const [requests, setRequests] = useState(initialRequests);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  function setStatus(id: string, status: "ACKNOWLEDGED" | "IN_PROGRESS" | "DONE" | "CANCELLED") {
    startTransition(async () => {
      setMessage("");
      try {
        const response = await fetch(`/api/captain/requests/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        });
        const json = await response.json();
        if (!json.success) throw new Error(json.error || "Update failed");
        setRequests((prev) =>
          status === "DONE" || status === "CANCELLED"
            ? prev.filter((row) => row.id !== id)
            : prev.map((row) => (row.id === id ? json.data : row)),
        );
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Update failed");
      }
    });
  }

  if (requests.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
        No open guest requests on your tables.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {message ? <p className="text-sm text-rose-700">{message}</p> : null}
      {requests.map((request) => (
        <article
          key={request.id}
          className="flex flex-col gap-3 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="font-bold">
              Table {request.tableNumber} · {request.type.replace(/_/g, " ")}
            </p>
            <p className="text-xs uppercase tracking-wide text-neutral-400">{request.status}</p>
            {request.note ? <p className="mt-1 text-sm text-neutral-600">{request.note}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {request.status === "OPEN" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setStatus(request.id, "ACKNOWLEDGED")}
                className="rounded-full bg-neutral-900 px-3 py-2 text-xs font-bold text-white"
              >
                Acknowledge
              </button>
            ) : null}
            {request.status !== "IN_PROGRESS" && request.status !== "DONE" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setStatus(request.id, "IN_PROGRESS")}
                className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-semibold"
              >
                In progress
              </button>
            ) : null}
            <button
              type="button"
              disabled={pending}
              onClick={() => setStatus(request.id, "DONE")}
              className="rounded-full bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
            >
              Complete
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
