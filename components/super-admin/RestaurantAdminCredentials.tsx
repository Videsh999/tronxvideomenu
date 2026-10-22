"use client";

import { useState } from "react";
import type { RestaurantAdminCredentialStatus, RestaurantAdminCredentialVerification } from "@/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const result = await response.json() as { success: boolean; data?: T; error?: string };
  if (!response.ok || !result.success) throw new Error(result.error ?? "Request failed");
  return result.data as T;
}

export default function RestaurantAdminCredentials({
  initialStatus,
  restaurantSlug,
}: {
  initialStatus: RestaurantAdminCredentialStatus;
  restaurantSlug: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [email, setEmail] = useState(initialStatus.email ?? "");
  const [password, setPassword] = useState("");
  const [savedPassword, setSavedPassword] = useState<string | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [editorOpen, setEditorOpen] = useState(initialStatus.credentialSource === "NONE" || initialStatus.needsPasswordSetup);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [verification, setVerification] = useState<RestaurantAdminCredentialVerification | null>(null);
  const basePath = `/api/super-admin/restaurant-admins/${encodeURIComponent(status.restaurantId)}`;
  const loginPath = `/menu/${restaurantSlug}/admin`;

  const copy = async (value: string, successText: string) => {
    try { await navigator.clipboard.writeText(value); setMessage(successText); }
    catch { setMessage("Clipboard access failed. Copy the value manually."); }
  };

  const retrievePassword = async () => {
    const credentials = await request<{ email: string; password: string }>(`${basePath}/password`, { method: "POST" });
    setEmail(credentials.email);
    return credentials.password;
  };

  const revealPassword = async () => {
    if (passwordVisible) {
      setSavedPassword(null);
      setPasswordVisible(false);
      return;
    }
    setBusy(true); setMessage("");
    try { setSavedPassword(await retrievePassword()); setPasswordVisible(true); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to retrieve administrator password."); }
    finally { setBusy(false); }
  };

  const copyPassword = async () => {
    setBusy(true); setMessage("");
    try { await copy(savedPassword ?? await retrievePassword(), "Restaurant Admin password copied."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to retrieve administrator password."); }
    finally { setBusy(false); }
  };

  const saveCredentials = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const nextStatus = await request<RestaurantAdminCredentialStatus>(basePath, {
        method: "PUT",
        body: JSON.stringify({ email, password }),
      });
      setStatus(nextStatus); setVerification(null); setEmail(nextStatus.email ?? ""); setPassword("");
      setSavedPassword(null); setPasswordVisible(false); setEditorOpen(false);
      setMessage("Restaurant Admin credentials saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save administrator credentials."); }
    finally { setBusy(false); }
  };

  const toggleActive = async () => {
    if (status.isActive === null) return;
    setBusy(true); setMessage("");
    try {
      const nextStatus = await request<RestaurantAdminCredentialStatus>(basePath, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !status.isActive }),
      });
      setStatus(nextStatus); setVerification(null); setMessage(`Restaurant Admin account ${nextStatus.isActive ? "activated" : "deactivated"}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update administrator status."); }
    finally { setBusy(false); }
  };

  const verifyDatabaseCredentials = async () => {
    setBusy(true); setMessage(""); setVerification(null);
    try {
      const result = await request<RestaurantAdminCredentialVerification>(`${basePath}/verify`, { method: "POST" });
      setVerification(result);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to verify database credentials."); }
    finally { setBusy(false); }
  };

  const migrateLegacy = async () => {
    setBusy(true); setMessage("");
    try {
      const nextStatus = await request<RestaurantAdminCredentialStatus>(`${basePath}/migrate`, { method: "POST" });
      setStatus(nextStatus); setVerification(null); setMessage("Migration request completed. Verify database login and password recovery before removing legacy variables.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to migrate legacy credentials."); }
    finally { setBusy(false); }
  };

  return <section className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-3" aria-label="Restaurant Admin credentials">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">Restaurant Admin account</p>
        <p className="mt-1 text-xs text-neutral-500">
          {status.email ?? "No administrator account"}
          {status.credentialSource === "LEGACY_ENV" ? " · Legacy environment credentials" : status.credentialSource === "DATABASE" ? ` · ${status.isActive ? "Active" : "Deactivated"}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {status.email && <button type="button" onClick={() => void copy(status.email!, "Restaurant Admin email copied.")} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-[11px] text-neutral-700">Copy email</button>}
        <a href={loginPath} target="_blank" rel="noopener noreferrer" className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-[11px] text-neutral-700">Open Admin Login</a>
        <button type="button" onClick={() => void copy(new URL(loginPath, window.location.origin).toString(), "Restaurant Admin login URL copied.")} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-[11px] text-neutral-700">Copy login URL</button>
      </div>
    </div>
    <p className="mt-2 text-xs text-neutral-500">Migration readiness: {readinessLabel(status)}</p>
    <p className={`mt-1 text-xs ${status.encryptionKeyStatus === "READY" ? "text-neutral-400" : "text-amber-700"}`}>Credential encryption configuration: {status.encryptionKeyStatus === "READY" ? "ready" : status.encryptionKeyStatus === "MISSING" ? "missing" : "invalid"}</p>
    {status.legacyFallbackRequired && <p className="mt-1 text-xs text-amber-700">Legacy environment fallback is still required. Do not remove this restaurant&apos;s legacy variables yet.</p>}
    {status.credentialSource === "DATABASE" && <button type="button" disabled={busy} onClick={() => void verifyDatabaseCredentials()} className="mt-3 rounded-md border border-sky-200 px-2.5 py-1.5 text-[11px] text-sky-700 disabled:opacity-50">{busy ? "Verifying…" : "Verify database login and recovery"}</button>}
    {verification && <p role="status" className={`mt-2 text-xs ${verification.verified ? "text-emerald-700" : "text-amber-700"}`}>{verification.verified ? "Verified: the saved encrypted password decrypts and authenticates through the tenant-scoped database login." : verificationLabel(verification.result)}</p>}
    {status.passwordConfigured && <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="min-w-44 rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 font-mono text-xs text-neutral-700">{passwordVisible ? savedPassword : "••••••••••••"}</span>
      <button type="button" disabled={busy} onClick={() => void revealPassword()} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-[11px] text-neutral-700 disabled:opacity-50">{passwordVisible ? "Hide password" : "Show password"}</button>
      <button type="button" disabled={busy} onClick={() => void copyPassword()} className="rounded-md border border-neutral-300 px-2.5 py-1.5 text-[11px] text-neutral-700 disabled:opacity-50">Copy password</button>
    </div>}
    {status.credentialSource === "LEGACY_ENV" && <div className="mt-3 flex flex-wrap items-center gap-2"><p className="text-xs text-amber-700">This account still uses trusted legacy environment configuration.</p><button type="button" disabled={busy} onClick={() => void migrateLegacy()} className="rounded-md border border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-700 disabled:opacity-50">Migrate to encrypted storage</button></div>}
    {status.credentialSource === "DATABASE" && <button type="button" disabled={busy} onClick={() => void toggleActive()} className="mt-3 rounded-md border border-neutral-300 px-2.5 py-1.5 text-[11px] text-neutral-700 disabled:opacity-50">{status.isActive ? "Deactivate account" : "Activate account"}</button>}
    {status.needsPasswordSetup && status.credentialSource === "DATABASE" && <p className="mt-2 text-xs text-amber-700">Only a password hash exists for this account. Set a new password explicitly to enable retrieval; the existing password cannot be reconstructed.</p>}
    <div className="mt-3">
      <button type="button" onClick={() => setEditorOpen((open) => !open)} className="text-xs font-medium text-sky-700 underline underline-offset-2">{editorOpen ? "Cancel credential editor" : status.credentialSource === "NONE" ? "Create admin account" : "Update credentials"}</button>
      {editorOpen && <form onSubmit={(event) => void saveCredentials(event)} className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-neutral-500">Administrator email<input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" className="mt-1 block h-9 w-full rounded-md border border-neutral-300 bg-neutral-100 px-2.5 text-xs text-neutral-900" /></label>
        <label className="text-[11px] text-neutral-500">{status.credentialSource === "NONE" ? "Password" : "New password"}<input type="password" required minLength={8} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" className="mt-1 block h-9 w-full rounded-md border border-neutral-300 bg-neutral-100 px-2.5 text-xs text-neutral-900" /></label>
        <button type="submit" disabled={busy} className="rounded-md bg-neutral-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 sm:col-span-2">{busy ? "Saving…" : status.credentialSource === "NONE" ? "Create account" : "Save new credentials"}</button>
      </form>}
    </div>
    {message && <p role="status" className="mt-2 text-xs text-neutral-600">{message}</p>}
  </section>;
}

function readinessLabel(status: RestaurantAdminCredentialStatus) {
  if (status.readiness === "NO_DATABASE_ACCOUNT") return "No database account; create one in Super Admin.";
  if (status.readiness === "LEGACY_FALLBACK_REQUIRED") return "Legacy login only; migration is required.";
  if (status.readiness === "DATABASE_LOGIN_CONFIGURATION_INVALID") return "Stored login hash is invalid; update credentials explicitly.";
  if (status.readiness === "DATABASE_ACCOUNT_INACTIVE") return "Database account is deactivated.";
  if (status.readiness === "RESTAURANT_INACTIVE") return "Restaurant is inactive; login cannot succeed until it is reactivated.";
  if (status.readiness === "DATABASE_PASSWORD_RECORD_INCOMPLETE") return "Encrypted password fields are incomplete; update credentials explicitly.";
  if (status.readiness === "DATABASE_LOGIN_READY_PASSWORD_UNRECOVERABLE") return "Login hash is present, but the original password is not recoverable. Set a new password explicitly.";
  if (status.readiness === "DATABASE_LOGIN_READY_ENCRYPTION_KEY_MISSING") return "Login hash is present; CREDENTIALS_ENCRYPTION_KEY is missing, so recovery cannot be checked.";
  if (status.readiness === "DATABASE_LOGIN_READY_ENCRYPTION_KEY_INVALID") return "Login hash is present; CREDENTIALS_ENCRYPTION_KEY is invalid, so recovery cannot be checked.";
  return "Database fields and key are present. Verify login and recovery before removing legacy variables.";
}

function verificationLabel(result: RestaurantAdminCredentialVerification["result"]) {
  const labels: Record<RestaurantAdminCredentialVerification["result"], string> = {
    VERIFIED_DATABASE_LOGIN_AND_RECOVERY: "Verified",
    NO_DATABASE_ACCOUNT: "No database-backed account exists.",
    INVALID_PASSWORD_HASH: "Stored login hash is invalid.",
    ACCOUNT_INACTIVE: "The administrator account is deactivated.",
    RESTAURANT_INACTIVE: "The restaurant is inactive.",
    PASSWORD_NOT_RECOVERABLE: "Only a hash is available; the original password cannot be recovered.",
    ENCRYPTION_KEY_MISSING: "CREDENTIALS_ENCRYPTION_KEY is missing.",
    ENCRYPTION_KEY_INVALID: "CREDENTIALS_ENCRYPTION_KEY is invalid.",
    STORED_CREDENTIALS_DO_NOT_MATCH: "The encrypted password and stored login hash do not match, or encrypted data is invalid.",
  };
  return labels[result];
}
