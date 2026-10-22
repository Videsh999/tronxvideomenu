"use client";

import { useEffect, useState } from "react";
import type { CaptainView } from "@/types";

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

export default function CaptainManagement({ restaurantSlug }: { restaurantSlug: string }) {
  const [captains, setCaptains] = useState<CaptainView[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [savedPasswords, setSavedPasswords] = useState<Record<string, string>>({});

  const refresh = async () => setCaptains(await request<CaptainView[]>("/api/admin/captains"));

  useEffect(() => {
    let mounted = true;
    request<CaptainView[]>("/api/admin/captains")
      .then((data) => { if (mounted) setCaptains(data); })
      .catch((error: unknown) => { if (mounted) setMessage(error instanceof Error ? error.message : "Unable to load Captains"); });
    return () => { mounted = false; };
  }, []);

  const copy = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch {
      setMessage("Clipboard access failed. Copy the value manually.");
    }
  };

  const getLoginPath = () => `/menu/${encodeURIComponent(restaurantSlug)}/captain`;

  const getPassword = async (captainId: string) => {
    const result = await request<{ password: string }>(`/api/admin/captains/${encodeURIComponent(captainId)}/credentials`, { method: "POST" });
    return result.password;
  };

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      await request<CaptainView>("/api/admin/captains", { method: "POST", body: JSON.stringify({ name, email, password }) });
      setName(""); setEmail(""); setPassword(""); await refresh(); setMessage("Captain created.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to create Captain"); }
    finally { setBusy(false); }
  };

  const toggle = async (captain: CaptainView) => {
    setPendingId(captain.id); setMessage("");
    try {
      await request(`/api/admin/captains/${encodeURIComponent(captain.id)}`, { method: "PATCH", body: JSON.stringify({ isActive: !captain.isActive }) });
      await refresh(); setMessage(`Captain ${captain.isActive ? "disabled" : "enabled"}.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update Captain"); }
    finally { setPendingId(null); }
  };

  const setNewPassword = async (captain: CaptainView) => {
    const nextPassword = window.prompt(`Set a new password for ${captain.name} (at least 8 characters). This also enables secure password retrieval:`);
    if (!nextPassword) return;
    if (nextPassword.length < 8) { setMessage("Password must contain at least 8 characters."); return; }
    setPendingId(captain.id); setMessage("");
    try {
      await request(`/api/admin/captains/${encodeURIComponent(captain.id)}/password`, { method: "POST", body: JSON.stringify({ password: nextPassword }) });
      await refresh(); setMessage("Captain password updated and saved for authorized retrieval.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update Captain password"); }
    finally { setPendingId(null); }
  };

  const togglePassword = async (captain: CaptainView) => {
    if (visibleIds.includes(captain.id)) {
      setVisibleIds((current) => current.filter((id) => id !== captain.id));
      setSavedPasswords((current) => { const next = { ...current }; delete next[captain.id]; return next; });
      return;
    }
    setPendingId(captain.id); setMessage("");
    try {
      const saved = await getPassword(captain.id);
      setSavedPasswords((current) => ({ ...current, [captain.id]: saved }));
      setVisibleIds((current) => [...current, captain.id]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to retrieve Captain password"); }
    finally { setPendingId(null); }
  };

  const copyPassword = async (captain: CaptainView) => {
    setPendingId(captain.id); setMessage("");
    try {
      const saved = savedPasswords[captain.id] ?? await getPassword(captain.id);
      await copy(saved, "Captain password copied.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to retrieve Captain password"); }
    finally { setPendingId(null); }
  };

  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl">Captain Access</h1><p className="mt-1 text-sm text-neutral-500">Create and manage staff accounts for your restaurant.</p></header>
    {message && <p role="status" className="text-sm text-neutral-600">{message}</p>}
    <form onSubmit={create} className="grid gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:grid-cols-2">
      <input aria-label="Name" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={100} className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm" />
      <input aria-label="Email" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm" />
      <input aria-label="Password" placeholder="Password (8+ characters)" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm" />
      <button disabled={busy} className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy ? "Creating…" : "Create Captain"}</button>
    </form>
    <section className="space-y-3">
      {captains.map((captain) => {
        const isPasswordVisible = visibleIds.includes(captain.id);
        const loginUrl = getLoginPath();
        return <article key={captain.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="font-semibold text-neutral-900">{captain.name}</h2><p className="text-sm text-neutral-500">{captain.email} · {captain.isActive ? "Enabled" : "Disabled"}</p></div>
            <button type="button" disabled={pendingId === captain.id} onClick={() => void toggle(captain)} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-700 disabled:opacity-50">{pendingId === captain.id ? "Working…" : captain.isActive ? "Disable" : "Enable"}</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="min-w-44 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-neutral-700">{isPasswordVisible ? savedPasswords[captain.id] : captain.passwordConfigured ? "••••••••••••" : "No recoverable password saved"}</span>
            {captain.passwordConfigured ? <>
              <button type="button" disabled={pendingId === captain.id} onClick={() => void togglePassword(captain)} className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-700 disabled:opacity-50">{isPasswordVisible ? "Hide password" : "Show password"}</button>
              <button type="button" disabled={pendingId === captain.id} onClick={() => void copyPassword(captain)} className="rounded-lg border border-neutral-300 px-3 py-2 text-neutral-700 disabled:opacity-50">Copy password</button>
            </> : <button type="button" disabled={pendingId === captain.id} onClick={() => void setNewPassword(captain)} className="rounded-lg border border-amber-200 px-3 py-2 text-amber-700 disabled:opacity-50">Set retrievable password</button>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void copy(captain.email, "Captain email copied.")} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-700">Copy email</button>
            {loginUrl && <>
              <a href={loginUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-700">Open Captain Login</a>
              <button type="button" onClick={() => void copy(new URL(loginUrl, window.location.origin).toString(), "Captain login URL copied.")} className="rounded-lg border border-neutral-300 px-3 py-2 text-xs text-neutral-700">Copy login URL</button>
            </>}
          </div>
        </article>;
      })}
      {captains.length === 0 && <p className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">No Captains added yet.</p>}
    </section>
  </div>;
}
