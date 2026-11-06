"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

function ResetForm() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const slug = params.slug;
  const token = search.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Reset token is missing.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/public/loyalty/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug: slug, token, password }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to reset password");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reset password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">Loyalty</p>
      <h1 className="mt-2 text-3xl font-bold text-neutral-900">Reset password</h1>
      <p className="mt-2 text-sm text-neutral-600">
        Choose a new password for your optional rewards account. Ordering never requires login.
      </p>

      {done ? (
        <div className="mt-8 space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-900">Password updated.</p>
          <Link
            href={`/menu/${slug}`}
            className="inline-flex h-11 items-center justify-center rounded-full bg-neutral-900 px-5 text-sm font-bold text-white"
          >
            Back to menu
          </Link>
        </div>
      ) : (
        <form
          className="mt-8 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="block text-xs font-semibold text-neutral-600">
            New password
            <input
              required
              type="password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-900"
              autoComplete="new-password"
            />
          </label>
          <label className="block text-xs font-semibold text-neutral-600">
            Confirm password
            <input
              required
              type="password"
              minLength={8}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm outline-none focus:border-neutral-900"
              autoComplete="new-password"
            />
          </label>
          {error ? <p className="text-sm text-rose-700">{error}</p> : null}
          <button
            type="submit"
            disabled={busy || !token}
            className="h-11 w-full rounded-full bg-neutral-900 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save new password"}
          </button>
        </form>
      )}
    </main>
  );
}

export default function LoyaltyResetPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center text-sm text-neutral-500">Loading…</main>}>
      <ResetForm />
    </Suspense>
  );
}
