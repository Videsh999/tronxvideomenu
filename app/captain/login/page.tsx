"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthLayout, { AuthError, AuthFallback, AuthField, AuthSubmit, PasswordInput, authInputClass } from "@/components/shared/AuthLayout";

function CaptainLoginForm() {
  const params = useSearchParams();
  const [restaurantSlug, setRestaurantSlug] = useState(params.get("restaurant") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/captain/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ restaurantSlug, email, password }) });
      const result = await response.json() as { success: boolean; error?: string; data?: { restaurantSlug: string } };
      if (!response.ok || !result.success || !result.data) throw new Error(result.error ?? "Unable to sign in");
      const next = params.get("next") ?? "";
      window.location.assign(next.startsWith(`/captain/${result.data.restaurantSlug}`) ? next : `/captain/${result.data.restaurantSlug}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in"); setBusy(false); }
  };
  return <AuthLayout
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
      <AuthField label="Restaurant ID"><input value={restaurantSlug} onChange={(e) => setRestaurantSlug(e.target.value)} autoComplete="organization" autoCapitalize="none" spellCheck={false} placeholder="e.g. moai-kitchen" required className={`${authInputClass} font-mono`} /></AuthField>
      <AuthField label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="captain@restaurant.com" required className={authInputClass} /></AuthField>
      <AuthField label="Password"><PasswordInput value={password} onChange={setPassword} /></AuthField>
      <AuthSubmit busy={busy} label="Sign in" busyLabel="Signing in…" />
      <p className="text-center text-xs text-neutral-400">
        Prefer your restaurant link? Use <span className="font-mono text-neutral-600">/menu/your-restaurant/captain</span>
        {" · "}
        Restaurant owner? <Link href="/admin/login" className="font-semibold text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline">Admin sign in</Link>
      </p>
    </form>
  </AuthLayout>;
}

export default function CaptainLoginPage() {
  return <Suspense fallback={<AuthFallback />}><CaptainLoginForm /></Suspense>;
}
