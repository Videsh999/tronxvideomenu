"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin page error:", error);
  }, [error]);

  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-neutral-200 bg-white px-6 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-600"><AlertTriangle className="h-5 w-5" /></span>
      <p className="mt-4 text-base font-semibold text-neutral-900">
        Unable to load admin data
      </p>
      <p className="mt-2 max-w-md text-sm text-neutral-500">
        Check the database connection and try again.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-bold text-white transition hover:bg-neutral-800"
      >
        <RotateCcw className="h-4 w-4" /> Try again
      </button>
    </div>
  );
}
