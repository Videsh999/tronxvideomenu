"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import AuthLayout, { AuthError, AuthFallback, AuthField, AuthSubmit, PasswordInput, authInputClass } from "@/components/shared/AuthLayout";

function SuperAdminLoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const next = searchParams.get("next") || "/super-admin";

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role: "SUPER_ADMIN" }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: string;
      };

      if (!result.success) {
        throw new Error(result.error || "Login failed");
      }

      window.location.assign(
        next.startsWith("/super-admin") ? next : "/super-admin",
      );
    } catch (loginError) {
      setError(
        loginError instanceof Error ? loginError.message : "Login failed",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout
      eyebrow="Super Admin"
      title="Platform control"
      description="Sign in to manage every restaurant on TRONX."
      highlights={[
        "Onboard restaurants and control their branding",
        "Toggle plans and features per restaurant",
        "Provision and verify restaurant admin credentials",
      ]}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthError message={error} />
        <AuthField label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="username"
            placeholder="admin@tronx.app"
            required
            className={authInputClass}
          />
        </AuthField>
        <AuthField label="Password">
          <PasswordInput value={password} onChange={setPassword} />
        </AuthField>
        <AuthSubmit busy={isSubmitting} label="Sign in" busyLabel="Signing in…" />
      </form>
    </AuthLayout>
  );
}

export default function SuperAdminLoginPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <SuperAdminLoginForm />
    </Suspense>
  );
}
