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
        throw new Error(result.error ?? "Unable to sign in");
      }
      const next = params.get("next") ?? "";
      window.location.assign(
        next.startsWith(`/captain/${result.data.restaurantSlug}`)
          ? next
          : `/captain/${result.data.restaurantSlug}`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Captain"
      title="Start your shift"
      description="Sign in to see your restaurant’s live orders and tables."
      highlights={[
        "Live order queue with one-tap status updates",
        "Table status at a glance across the floor",
        "Record payments without leaving the order",
      ]}
    >
      <form onSubmit={submit} className="space-y-5">
        <AuthError message={error || null} />
        <AuthField label="Restaurant slug (optional)">
          <input
            type="text"
            value={restaurantSlug}
            onChange={(event) => setRestaurantSlug(event.target.value)}
            autoComplete="organization"
            placeholder="your-restaurant"
            className={authInputClass}
          />
          <span className="mt-1.5 block text-xs font-normal text-neutral-500">
            Needed only if the same email is used at more than one restaurant. Prefer{" "}
            <span className="font-mono text-neutral-700">/menu/…/captain</span>.
          </span>
        </AuthField>
        <AuthField label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            placeholder="captain@restaurant.com"
            required
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="Password">
          <PasswordInput value={password} onChange={setPassword} />
        </AuthField>
        <AuthSubmit busy={busy} label="Sign in" busyLabel="Signing in…" />
        <p className="text-center text-sm text-neutral-500">
          Restaurant owner?{" "}
          <Link href="/admin/login" className="font-bold text-neutral-900">
            Admin sign in
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
