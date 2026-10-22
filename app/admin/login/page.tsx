"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthLayout, { AuthError, AuthFallback, AuthField, AuthSubmit, PasswordInput, authInputClass } from "@/components/shared/AuthLayout";

function AdminLoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const next = searchParams.get("next") || "/admin";
  const requestedRestaurant = next.startsWith("/admin/")
    ? next.replace("/admin/", "").split("/")[0]
    : "";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          role: "RESTAURANT_ADMIN",
          restaurantSlug: requestedRestaurant || undefined,
        }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: { restaurantSlug?: string };
      };

      if (!result.success) {
        throw new Error(result.error || "Login failed");
      }

      const restaurantSlug = result.data?.restaurantSlug;
      const safeNext =
        restaurantSlug && next.startsWith(`/admin/${restaurantSlug}`)
          ? next
          : restaurantSlug
            ? `/admin/${restaurantSlug}`
            : "/admin/login";
      window.location.assign(safeNext);
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Login failed",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Restaurant Admin"
      title="Welcome back"
      description="Sign in to manage your menu, tables, orders, and team."
      highlights={[
        "Update dishes, prices, videos, and add-ons in seconds",
        "Track every order live and record payments",
        "Generate table QR codes and manage reservations",
      ]}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthError message={error} />
        {requestedRestaurant ? (
          <p className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs text-neutral-500">
            Signing in to <span className="font-mono text-neutral-800">{requestedRestaurant}</span>
          </p>
        ) : null}
        <AuthField label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            placeholder="you@restaurant.com"
            required
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="Password">
          <PasswordInput value={password} onChange={setPassword} />
        </AuthField>
        <AuthSubmit busy={isSubmitting} label="Sign in" busyLabel="Signing in…" />
        <p className="text-center text-xs text-neutral-400">
          Prefer your restaurant link? Use <span className="font-mono text-neutral-600">/menu/your-restaurant/admin</span>
          {" · "}
          Floor staff? <Link href="/captain/login" className="font-semibold text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline">Captain sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <AdminLoginForm />
    </Suspense>
  );
}
