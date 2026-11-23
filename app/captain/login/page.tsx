"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthLayout, {
  AuthError,
  AuthFallback,
  AuthField,
  AuthSubmit,
  PasswordInput,
  authInputClass,
} from "@/components/shared/AuthLayout";

function CaptainLoginForm() {
  const params = useSearchParams();
  const [restaurantSlug, setRestaurantSlug] = useState(params.get("restaurant") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showExtra, setShowExtra] = useState(Boolean(params.get("restaurant")));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/captain/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(restaurantSlug.trim() ? { restaurantSlug: restaurantSlug.trim() } : {}),
          email,
          password,
        }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: { restaurantSlug: string };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "Wrong email or password");
      }
      const next = params.get("next") ?? "";
      window.location.assign(
        next.startsWith(`/captain/${result.data.restaurantSlug}`)
          ? next
          : `/captain/${result.data.restaurantSlug}/tables`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open. Try again.");
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Captain"
      title="Open tables"
      description="Enter email and password. Then tap your table and take the order."
      highlights={[
        "Tap table → add food → send kitchen → bill → free table",
        "Big buttons. One step at a time.",
        "Ask owner if login does not work.",
      ]}
    >
      <form onSubmit={submit} className="space-y-5">
        <AuthError message={error || null} />
        <AuthField label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            inputMode="email"
            placeholder="your email"
            required
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="Password">
          <PasswordInput value={password} onChange={setPassword} placeholder="password" />
        </AuthField>
        {showExtra ? (
          <AuthField label="Restaurant code (only if asked)">
            <input
              type="text"
              value={restaurantSlug}
              onChange={(event) => setRestaurantSlug(event.target.value)}
              autoComplete="organization"
              placeholder="restaurant code"
              className={authInputClass}
            />
          </AuthField>
        ) : (
          <button
            type="button"
            onClick={() => setShowExtra(true)}
            className="text-sm font-semibold text-neutral-500 underline"
          >
            Need restaurant code?
          </button>
        )}
        <AuthSubmit busy={busy} label="Open app" busyLabel="Opening…" />
        <p className="text-center text-sm text-neutral-500">
          Owner?{" "}
          <Link href="/admin/login" className="font-bold text-neutral-900">
            Admin login
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default function CaptainLoginPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <CaptainLoginForm />
    </Suspense>
  );
}
