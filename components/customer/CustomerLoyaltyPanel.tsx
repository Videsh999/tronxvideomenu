"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, Gift, Loader2, X } from "lucide-react";
import type { CustomerLoyaltyView } from "@/types";

type Mode = "idle" | "login" | "register" | "forgot";

type Props = {
  restaurantSlug: string;
  restaurantName: string;
};

const inputClass =
  "customer-input mt-1.5 h-12 w-full rounded-xl border border-[var(--customer-border)] bg-white px-3.5 text-base text-neutral-900 outline-none sm:text-sm";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-xs font-semibold text-neutral-600">
      <span className="flex items-baseline justify-between gap-2">
        <span>{label}</span>
        {hint ? <span className="font-medium text-neutral-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function PasswordField({
  label,
  hint,
  value,
  onChange,
  autoComplete,
  minLength,
  required = true,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  minLength?: number;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input
          required={required}
          type={visible ? "text" : "password"}
          minLength={minLength}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} pr-12`}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-neutral-500 transition hover:bg-neutral-50 hover:text-neutral-900"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

export default function CustomerLoyaltyPanel({ restaurantSlug, restaurantName }: Props) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phoneOrEmail, setPhoneOrEmail] = useState("");

  const refresh = async () => {
    try {
      const response = await fetch("/api/public/loyalty/me", { cache: "no-store" });
      const json = (await response.json()) as {
        success: boolean;
        data: { customer: CustomerLoyaltyView; restaurantSlug: string } | null;
        error?: string;
      };
      if (!response.ok) {
        setCustomer(null);
        return;
      }
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
    setMounted(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [restaurantSlug]);

  useEffect(() => {
    if (!open) return;
    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      document.removeEventListener("keydown", onKeyDown);
      previousActive?.focus({ preventScroll: true });
    };
  }, [open]);

  const resetForm = () => {
    setError("");
    setInfo("");
    setResetPath(null);
    setPassword("");
    setConfirmPassword("");
  };

  const openPanel = () => {
    resetForm();
    setMode(customer ? "idle" : "login");
    setOpen(true);
  };

  const switchMode = (next: Mode) => {
    resetForm();
    if (next === "forgot" && phoneOrEmail.includes("@")) {
      setEmail(phoneOrEmail.trim());
    }
    setMode(next);
  };

  const submitLogin = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/public/loyalty/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug, phoneOrEmail: phoneOrEmail.trim(), password }),
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
    const trimmedPhone = phone.replace(/[^\d+]/g, "").trim();
    if (trimmedPhone.length < 7) {
      setError("Enter a valid phone number with at least 7 digits.");
      setBusy(false);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setBusy(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/public/loyalty/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantSlug,
          name: name.trim(),
          phone: trimmedPhone,
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Unable to create account");
      setCustomer(json.data.customer);
      setMode("idle");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create account");
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
        body: JSON.stringify({ restaurantSlug, email: email.trim().toLowerCase() }),
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

  const primaryButtonClass =
    "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--restaurant-text)] text-sm font-bold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <>
      <button
        type="button"
        onClick={openPanel}
        aria-label="Loyalty rewards"
        className="inline-flex h-11 items-center gap-1.5 rounded-full border border-[var(--customer-border)] px-3 text-sm font-semibold text-neutral-800 transition hover:bg-neutral-50 sm:gap-2 sm:px-4"
      >
        <Gift className="h-4 w-4 shrink-0" />
        <span className="max-w-[7.5rem] truncate sm:max-w-none">
          {loading ? "Rewards" : customer ? `${customer.loyaltyPoints} pts` : "Rewards"}
        </span>
      </button>

      {mounted && open
        ? createPortal(
            <div
              className="fixed inset-0 z-[60] flex animate-fade-in items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setOpen(false);
              }}
            >
              <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                className="safe-bottom flex max-h-[92dvh] w-full max-w-md animate-sheet-up flex-col overflow-hidden rounded-t-[1.75rem] border border-[var(--customer-border)] bg-white shadow-2xl sm:animate-scale-in sm:rounded-[1.75rem]"
              >
                <div className="flex justify-center pt-3 sm:hidden">
                  <span className="h-1.5 w-12 rounded-full bg-neutral-200" />
                </div>
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-neutral-100 bg-white/95 px-5 pb-4 pt-5 backdrop-blur">
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
                  Optional rewards
                </p>
                <h2 id={titleId} className="mt-1 truncate text-xl font-bold text-[var(--restaurant-text)]">
                  {restaurantName}
                </h2>
                <p className="mt-1 text-sm leading-snug text-neutral-500">
                  Ordering never requires login. Sign in only for points and coupons.
                </p>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-100 text-neutral-600 transition hover:bg-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain px-5 py-5">
              {customer && mode === "idle" ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[var(--customer-border)] bg-neutral-50 p-4">
                    <p className="text-sm font-semibold">{customer.name || "Member"}</p>
                    <p className="mt-1 text-xs text-neutral-500">{customer.phone}</p>
                    {customer.email ? (
                      <p className="mt-0.5 truncate text-xs text-neutral-500">{customer.email}</p>
                    ) : null}
                    <p className="mt-3 text-3xl font-bold tabular-nums">{customer.loyaltyPoints}</p>
                    <p className="text-xs text-neutral-500">
                      loyalty points · {customer.totalOrders} visits
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-500">
                    Points are credited after payment when you place orders while signed in.
                  </p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void logout()}
                    className="h-12 w-full rounded-full border border-[var(--customer-border)] text-sm font-semibold disabled:opacity-50"
                  >
                    {busy ? "Signing out…" : "Sign out of rewards"}
                  </button>
                </div>
              ) : null}

              {mode === "login" || mode === "register" ? (
                <div className="mb-4 grid grid-cols-2 gap-1 rounded-full bg-neutral-100 p-1">
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className={`h-10 rounded-full text-sm font-semibold transition ${
                      mode === "login"
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-500 hover:text-neutral-800"
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("register")}
                    className={`h-10 rounded-full text-sm font-semibold transition ${
                      mode === "register"
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-500 hover:text-neutral-800"
                    }`}
                  >
                    Join
                  </button>
                </div>
              ) : null}

              {mode === "login" ? (
                <form
                  className="space-y-3.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitLogin();
                  }}
                >
                  <Field label="Phone or email">
                    <input
                      required
                      value={phoneOrEmail}
                      onChange={(event) => setPhoneOrEmail(event.target.value)}
                      className={inputClass}
                      autoComplete="username"
                      inputMode="email"
                      placeholder="98765 43210 or you@email.com"
                    />
                  </Field>
                  <PasswordField
                    label="Password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                  />
                  {error ? (
                    <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                      {error}
                    </p>
                  ) : null}
                  <button type="submit" disabled={busy} className={primaryButtonClass}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {busy ? "Signing in…" : "Sign in"}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="w-full py-1 text-center text-xs font-semibold text-neutral-500 transition hover:text-neutral-800"
                  >
                    Forgot password?
                  </button>
                </form>
              ) : null}

              {mode === "register" ? (
                <form
                  className="space-y-3.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitRegister();
                  }}
                >
                  <Field label="Full name">
                    <input
                      required
                      minLength={2}
                      maxLength={80}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={inputClass}
                      autoComplete="name"
                      placeholder="Your name"
                    />
                  </Field>
                  <Field label="Phone" hint="min 7 digits">
                    <input
                      required
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      className={inputClass}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="+91 98765 43210"
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={inputClass}
                      autoComplete="email"
                      placeholder="you@email.com"
                    />
                  </Field>
                  <PasswordField
                    label="Password"
                    hint="min 8"
                    value={password}
                    onChange={setPassword}
                    autoComplete="new-password"
                    minLength={8}
                  />
                  <PasswordField
                    label="Confirm password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                    minLength={8}
                  />
                  {error ? (
                    <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                      {error}
                    </p>
                  ) : null}
                  <button type="submit" disabled={busy} className={primaryButtonClass}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {busy ? "Creating account…" : "Join rewards"}
                  </button>
                  <p className="text-center text-[11px] leading-relaxed text-neutral-400">
                    By joining you create an optional rewards account for this restaurant only.
                  </p>
                </form>
              ) : null}

              {mode === "forgot" ? (
                <form
                  className="space-y-3.5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitForgot();
                  }}
                >
                  <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm text-neutral-600">
                    Enter the email on your rewards account. We’ll send a reset link when mail is configured, or show one here for local setups.
                  </div>
                  <Field label="Account email">
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className={inputClass}
                      autoComplete="email"
                      placeholder="you@email.com"
                    />
                  </Field>
                  {error ? (
                    <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                      {error}
                    </p>
                  ) : null}
                  {info ? (
                    <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-900">
                      {info}
                    </p>
                  ) : null}
                  {resetPath ? (
                    <a
                      href={resetPath}
                      className="block rounded-xl border border-[var(--customer-border)] bg-white px-3.5 py-3 text-sm font-semibold text-[var(--restaurant-primary)] underline-offset-2 hover:underline"
                    >
                      Open reset link
                    </a>
                  ) : null}
                  <button type="submit" disabled={busy} className={primaryButtonClass}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {busy ? "Sending…" : "Send reset link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("login")}
                    className="w-full py-1 text-center text-xs font-semibold text-neutral-500 transition hover:text-neutral-800"
                  >
                    Back to sign in
                  </button>
                </form>
              ) : null}
            </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
