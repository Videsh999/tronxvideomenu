"use client";

import { useEffect, useState } from "react";
import { Gift, X } from "lucide-react";
import type { CustomerLoyaltyView } from "@/types";

type Mode = "idle" | "login" | "register" | "forgot";

type Props = {
  restaurantSlug: string;
  restaurantName: string;
};

export default function CustomerLoyaltyPanel({ restaurantSlug, restaurantName }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("idle");
  const [customer, setCustomer] = useState<CustomerLoyaltyView | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [resetPath, setResetPath] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneOrEmail, setPhoneOrEmail] = useState("");

  const refresh = async () => {
    try {
      const response = await fetch("/api/public/loyalty/me", { cache: "no-store" });
      const json = (await response.json()) as {
        success: boolean;
        data: { customer: CustomerLoyaltyView; restaurantSlug: string } | null;
      };
      if (json.success && json.data?.restaurantSlug === restaurantSlug) {
        setCustomer(json.data.customer);
      } else {
        setCustomer(null);
      }
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [restaurantSlug]);

  const resetForm = () => {
    setError("");
    setInfo("");
    setResetPath(null);
    setPassword("");
  };

  const openPanel = () => {
    resetForm();
    setMode(customer ? "idle" : "login");
    setOpen(true);
  };

  const submitLogin = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/public/loyalty/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug, phoneOrEmail, password }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to sign in");
      setCustomer(json.data.customer);
      setMode("idle");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to sign in");
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/public/loyalty/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug, name, phone, email, password }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to register");
      setCustomer(json.data.customer);
      setMode("idle");
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register");
    } finally {
      setBusy(false);
    }
  };

  const submitForgot = async () => {
    setBusy(true);
    setError("");
    setInfo("");
    setResetPath(null);
    try {
      const response = await fetch("/api/public/loyalty/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug, email }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to start reset");
      setInfo(json.data.message);
      setResetPath(json.data.resetPath ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start reset");
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    setBusy(true);
    try {
      await fetch("/api/public/loyalty/logout", { method: "POST" });
      setCustomer(null);
      setMode("login");
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    "mt-1 h-11 w-full rounded-xl border border-[var(--customer-border)] bg-white px-3 text-sm outline-none focus:border-[var(--restaurant-primary)]";

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label="Loyalty rewards"
        className="inline-flex h-11 items-center gap-2 rounded-full border border-[var(--customer-border)] px-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 sm:px-4"
      >
        <Gift className="h-4 w-4" />
        <span className="hidden md:inline">
          {loading ? "Rewards" : customer ? `${customer.loyaltyPoints} pts` : "Rewards"}
        </span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-3 sm:items-center">
          <div
            role="dialog"
            aria-label="Loyalty rewards"
            className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-[var(--customer-border)] bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                  Optional rewards
                </p>
                <h2 className="mt-1 text-xl font-bold text-[var(--restaurant-text)]">{restaurantName}</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Ordering never requires login. Sign in only if you want loyalty points or coupons.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {customer && mode === "idle" ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-[var(--customer-border)] bg-neutral-50 p-4">
                  <p className="text-sm font-semibold">{customer.name || "Member"}</p>
                  <p className="mt-1 text-xs text-neutral-500">{customer.phone}</p>
                  <p className="mt-3 text-3xl font-bold tabular-nums">{customer.loyaltyPoints}</p>
                  <p className="text-xs text-neutral-500">loyalty points · {customer.totalOrders} visits</p>
                </div>
                <p className="text-xs text-neutral-500">
                  Points are credited after payment when you place orders while signed in.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void logout()}
                  className="h-11 w-full rounded-full border border-[var(--customer-border)] text-sm font-semibold"
                >
                  Sign out of rewards
                </button>
              </div>
            ) : null}

            {mode === "login" ? (
              <form
                className="mt-5 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitLogin();
                }}
              >
                <label className="block text-xs font-semibold text-neutral-600">
                  Phone or email
                  <input
                    required
                    value={phoneOrEmail}
                    onChange={(event) => setPhoneOrEmail(event.target.value)}
                    className={inputClass}
                    autoComplete="username"
                  />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Password
                  <input
                    required
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={inputClass}
                    autoComplete="current-password"
                  />
                </label>
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
                <button
                  type="submit"
                  disabled={busy}
                  className="h-11 w-full rounded-full bg-[var(--restaurant-text)] text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? "Signing in…" : "Sign in"}
                </button>
                <div className="flex justify-between gap-2 text-xs font-semibold">
                  <button type="button" onClick={() => { resetForm(); setMode("register"); }} className="text-[var(--restaurant-primary)]">
                    Create account
                  </button>
                  <button type="button" onClick={() => { resetForm(); setMode("forgot"); }} className="text-neutral-500">
                    Forgot password
                  </button>
                </div>
              </form>
            ) : null}

            {mode === "register" ? (
              <form
                className="mt-5 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitRegister();
                }}
              >
                <label className="block text-xs font-semibold text-neutral-600">
                  Name
                  <input required value={name} onChange={(event) => setName(event.target.value)} className={inputClass} />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Phone
                  <input required value={phone} onChange={(event) => setPhone(event.target.value)} className={inputClass} inputMode="tel" />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Email
                  <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} autoComplete="email" />
                </label>
                <label className="block text-xs font-semibold text-neutral-600">
                  Password (min 8)
                  <input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} autoComplete="new-password" />
                </label>
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
                <button
                  type="submit"
                  disabled={busy}
                  className="h-11 w-full rounded-full bg-[var(--restaurant-text)] text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? "Creating…" : "Join rewards"}
                </button>
                <button type="button" onClick={() => { resetForm(); setMode("login"); }} className="w-full text-xs font-semibold text-neutral-500">
                  Already have an account? Sign in
                </button>
              </form>
            ) : null}

            {mode === "forgot" ? (
              <form
                className="mt-5 space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void submitForgot();
                }}
              >
                <label className="block text-xs font-semibold text-neutral-600">
                  Account email
                  <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} />
                </label>
                {error ? <p className="text-sm text-rose-700">{error}</p> : null}
                {info ? <p className="text-sm text-emerald-800">{info}</p> : null}
                {resetPath ? (
                  <a href={resetPath} className="block break-all text-sm font-semibold text-[var(--restaurant-primary)] underline">
                    Open reset link
                  </a>
                ) : null}
                <button
                  type="submit"
                  disabled={busy}
                  className="h-11 w-full rounded-full bg-[var(--restaurant-text)] text-sm font-bold text-white disabled:opacity-50"
                >
                  {busy ? "Sending…" : "Get reset link"}
                </button>
                <button type="button" onClick={() => { resetForm(); setMode("login"); }} className="w-full text-xs font-semibold text-neutral-500">
                  Back to sign in
                </button>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
