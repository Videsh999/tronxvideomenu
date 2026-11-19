"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import AuthLayout, {
  AuthError,
  AuthFallback,
  AuthField,
  AuthSubmit,
  PasswordInput,
} from "@/components/shared/AuthLayout";

function ResetForm() {
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const slug = params.slug;
  const token = search.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Reset token is missing. Request a new link from Rewards → Forgot password.");
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
    <AuthLayout
      eyebrow="Loyalty rewards"
      title={done ? "Password updated" : "Reset password"}
      description={
        done
          ? "Your rewards password is ready. You can sign in from the menu Rewards button."
          : "Choose a new password for your optional rewards account. Ordering never requires login."
      }
      highlights={[
        "One-hour secure reset link",
        "Points stay on your account after reset",
        "Sign in only when you want rewards",
      ]}
    >
      {done ? (
        <div className="space-y-4">
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-900">
            Password saved. Use Rewards on the guest menu to sign in.
          </p>
          <Link
            href={`/menu/${slug}`}
            className="bg-brand-gradient inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-bold text-white"
          >
            Back to menu
          </Link>
        </div>
      ) : (
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <AuthError message={error} />
          {!token ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-900">
              This page needs a valid reset token. Open Rewards on the menu and use Forgot password.
            </p>
          ) : null}
          <AuthField label="New password">
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              minLength={8}
              placeholder="At least 8 characters"
            />
          </AuthField>
          <AuthField label="Confirm password">
            <PasswordInput
              value={confirm}
              onChange={setConfirm}
              autoComplete="new-password"
              minLength={8}
              placeholder="Repeat password"
            />
          </AuthField>
          <AuthSubmit busy={busy} label="Save new password" busyLabel="Saving…" />
          <p className="text-center text-xs text-neutral-400">
            <Link
              href={`/menu/${slug}`}
              className="font-semibold text-neutral-600 underline-offset-4 hover:text-neutral-900 hover:underline"
            >
              Back to guest menu
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}

export default function LoyaltyResetPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <ResetForm />
    </Suspense>
  );
}
