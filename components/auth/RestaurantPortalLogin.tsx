"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import AuthLayout, { AuthError, AuthField, AuthSubmit, PasswordInput, authInputClass } from "@/components/shared/AuthLayout";

type PortalKind = "admin" | "captain";

export default function RestaurantPortalLogin({
  kind,
  slug,
  restaurantName,
}: {
  kind: PortalKind;
  slug: string;
  restaurantName: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isAdmin = kind === "admin";
  const otherHref = isAdmin ? `/menu/${slug}/captain` : `/menu/${slug}/admin`;
  const otherLabel = isAdmin ? "Captain / waiter sign in" : "Restaurant admin sign in";
  const menuHref = `/menu/${slug}`;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (isAdmin) {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            password,
            role: "RESTAURANT_ADMIN",
            restaurantSlug: slug,
          }),
        });
        const result = (await response.json()) as {
          success: boolean;
          error?: string;
          data?: { restaurantSlug?: string };
        };
        if (!response.ok || !result.success) {
          throw new Error(result.error || "Login failed");
        }
        const restaurantSlug = result.data?.restaurantSlug ?? slug;
        window.location.assign(`/admin/${restaurantSlug}`);
        return;
      }

      const response = await fetch("/api/captain/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantSlug: slug, email, password }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
        data?: { restaurantSlug: string };
      };
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.error ?? "Unable to sign in");
      }
      window.location.assign(`/captain/${result.data.restaurantSlug}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in");
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      eyebrow={isAdmin ? "Restaurant Admin" : "Captain / Waiter"}
      title={isAdmin ? `Manage ${restaurantName}` : `Shift at ${restaurantName}`}
      description={
        isAdmin
          ? "Sign in to edit the menu, tables, orders, and give access to captains."
          : "Sign in to accept orders, print kitchen tickets, serve tables, and take payment."
      }
      highlights={
        isAdmin
          ? [
              "Menu, photos, videos, and add-ons",
              "Tables, QR codes, and live orders",
              "Create captain logins for your waiters",
            ]
          : [
              "Accept orders and print the KOT",
              "Track kitchen → ready → served",
              "Record Cash, UPI, or Card payments",
            ]
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <AuthError message={error} />
        <p className="rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs text-neutral-500">
          Signing in to <span className="font-semibold text-neutral-900">{restaurantName}</span>
          <span className="mt-0.5 block font-mono text-neutral-600">/menu/{slug}</span>
        </p>
        <AuthField label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            placeholder={isAdmin ? "owner@restaurant.com" : "waiter@restaurant.com"}
            required
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="Password">
          <PasswordInput value={password} onChange={setPassword} />
        </AuthField>
        <AuthSubmit busy={busy} label="Sign in" busyLabel="Signing in…" />
        <p className="text-center text-xs text-neutral-400">
          {isAdmin ? "Floor staff?" : "Restaurant owner?"}{" "}
          <Link href={otherHref} className="font-semibold text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline">
            {otherLabel}
          </Link>
        </p>
        <p className="text-center text-xs text-neutral-400">
          <Link href={menuHref} className="font-semibold text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline">
            Back to guest menu
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
